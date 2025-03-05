import * as R from 'ramda'
import {
  AssignStepAST,
  CallStepAST,
  ForStepAST,
  RaiseStepAST,
  ReturnStepAST,
  SwitchStepAST,
  VariableAssignment,
  WorkflowParameters,
  WorkflowStepAST,
} from '../ast/steps.js'
import { InternalTranspilingError } from '../errors.js'
import { isRecord, mapRecordValues } from '../utils.js'
import {
  BinaryExpression,
  Expression,
  FunctionInvocationExpression,
  MemberExpression,
  Primitive,
  PrimitiveExpression,
  UnaryExpression,
  VariableReferenceExpression,
  isExpression,
  isLiteral,
} from '../ast/expressions.js'
import { blockingFunctions } from './generated/functionMetadata.js'

const Unmodified = Symbol()
type Unmodified = typeof Unmodified
type ExpressionTransformer = (x: Expression) => Expression | Unmodified

/**
 * Performs various transformations on the AST.
 *
 * This flat list of steps and does not recurse into nested steps. This gets
 * called on each nesting level separately.
 */
export const transformAST: (steps: WorkflowStepAST[]) => WorkflowStepAST[] =
  R.pipe(
    mapLiteralsAsAssignSteps,
    mergeAssignSteps,
    flattenPlainNextConditions,
    runtimeFunctionImplementation,
    blockingCallsAsCallSteps,
  )

/**
 * Merge consecutive assign steps into one assign step
 *
 * An assign step can contain up to 50 assignments.
 */
function mergeAssignSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : null

    if (
      current.tag === 'assign' &&
      prev?.tag === 'assign' &&
      prev.assignments.length < 50 &&
      !prev.next
    ) {
      const merged = new AssignStepAST(
        prev.assignments.concat(current.assignments),
        current.next,
        prev.label ?? current.label,
      )

      acc.pop()
      acc.push(merged)
    } else {
      acc.push(current)
    }

    return acc
  }, [])
}

/**
 * Merge a next step to the previous step.
 *
 * For example, transforms this:
 *
 * switch:
 *   - condition: ${x > 0}
 *     steps:
 *       - next1:
 *           steps:
 *             next: target1
 *
 * into this:
 *
 * switch:
 *   - condition: ${x > 0}
 *     next: target1
 */
export function flattenPlainNextConditions(
  steps: WorkflowStepAST[],
): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], step: WorkflowStepAST) => {
    if (acc.length > 0 && step.tag === 'next') {
      // Merge a "next" to the previous "assign" step
      const prev = acc[acc.length - 1]

      if (prev.tag === 'assign' && !prev.next) {
        acc.pop()
        acc.push(prev.withNext(step.target))
      } else {
        acc.push(step)
      }
    } else if (step.tag === 'switch') {
      // If the condition steps consists of a single "next", merge it with the condition
      acc.push(flattenNextToCondition(step))
    } else {
      acc.push(step)
    }

    return acc
  }, [])
}

function flattenNextToCondition(step: SwitchStepAST): SwitchStepAST {
  const transformedBranches = step.branches.map((cond) => {
    if (!cond.next && cond.steps.length === 1 && cond.steps[0].tag === 'next') {
      const nextStep = cond.steps[0]
      return {
        condition: cond.condition,
        steps: [],
        next: nextStep.target,
      }
    } else {
      return cond
    }
  })

  return new SwitchStepAST(transformedBranches)
}

/**
 * Search for blocking calls in expressions and replace them with call step + variable.
 *
 * The Workflows runtime requires that blocking calls must be executed by call steps.
 *
 * For example, transforms this:
 *
 * - return1:
 *     return: ${http.get("https://example.com")}
 *
 * into this:
 *
 * - call_http_get_1:
 *     call: http.get
 *     args:
 *       url: https://example.com
 *     result: __temp0
 * - return1:
 *     return: ${__temp0}
 */
function blockingCallsAsCallSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  const transformer = (ex: Expression): [WorkflowStepAST[], Expression] => {
    const generateTemporaryVariableName = createTempVariableGenerator()
    const { transformedExpression, callSteps } = replaceBlockingCalls(
      ex,
      generateTemporaryVariableName,
    )

    return [callSteps, transformedExpression]
  }

  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const transformedSteps = transformStepExpressions(current, transformer)
    acc.push(...transformedSteps)

    return acc
  }, [])
}

function createTempVariableGenerator(): () => string {
  let i = 0
  return () => `__temp${i++}`
}

function replaceBlockingCalls(
  expression: Expression,
  generateName: () => string,
): { transformedExpression: Expression; callSteps: CallStepAST[] } {
  function replaceBlockingFunctionInvocations(
    ex: Expression,
  ): Expression | Unmodified {
    if (ex.expressionType === 'functionInvocation') {
      const callStepsForArguments: CallStepAST[] = []
      const replacedArguments = ex.arguments.map((ex) => {
        const replaced = replaceBlockingCalls(ex, generateName)
        callStepsForArguments.push(...replaced.callSteps)
        return replaced.transformedExpression
      })

      const blockingCallArgumentNames = blockingFunctions.get(ex.functionName)
      if (blockingCallArgumentNames) {
        if (replacedArguments.length > blockingCallArgumentNames.length) {
          throw new InternalTranspilingError(
            'FunctionInvocationTerm has more arguments than metadata allows!',
          )
        }

        const nameAndValue = replacedArguments.map(
          (val, i) => [blockingCallArgumentNames[i], val] as const,
        )
        const args: WorkflowParameters = Object.fromEntries(nameAndValue)
        const tempCallResultVariable = generateName()

        callSteps.push(...callStepsForArguments)
        callSteps.push(
          new CallStepAST(ex.functionName, args, tempCallResultVariable),
        )

        // replace function invocation with a reference to the temporary variable
        return new VariableReferenceExpression(tempCallResultVariable)
      } else {
        return Unmodified
      }
    } else {
      return Unmodified
    }
  }

  const callSteps: CallStepAST[] = []

  return {
    transformedExpression: transformExpression(
      expression,
      replaceBlockingFunctionInvocations,
    ),
    callSteps,
  }
}

/**
 * Transform expressions in a step by applying transform.
 *
 * Returns an array of steps. The array includes the transformed step and possibly
 * additional steps constructed during the transformation. For example, a
 * transformation might extract blocking call expressions into call steps.
 */
function transformStepExpressions(
  step: WorkflowStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  switch (step.tag) {
    case 'assign':
      return transformExpressionsAssign(step, transform)

    case 'call':
      return transformExpressionsCall(step, transform)

    case 'for':
      return transformExpressionsFor(step, transform)

    case 'raise':
      return transformExpressionsRaise(step, transform)

    case 'return':
      return transformExpressionsReturn(step, transform)

    case 'switch':
      return transformExpressionsSwitch(step, transform)

    case 'next':
    case 'parallel':
    case 'steps':
    case 'try':
    case 'jumptarget':
      return [step]
  }
}

function transformExpressionsAssign(
  step: AssignStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.assignments) {
    const newSteps: WorkflowStepAST[] = []
    const newAssignments = step.assignments.map(([name, ex]) => {
      const [steps2, ex2] = transform(ex)
      newSteps.push(...steps2)
      return [name, ex2] as const
    })
    newSteps.push(new AssignStepAST(newAssignments, step.next, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsCall(
  step: CallStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.args) {
    const newSteps: WorkflowStepAST[] = []
    const newArgs = mapRecordValues(step.args, (ex) => {
      const [steps2, ex2] = transform(ex)
      newSteps.push(...steps2)
      return ex2
    })
    newSteps.push(new CallStepAST(step.call, newArgs, step.result, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsFor(
  step: ForStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.listExpression) {
    const [newSteps, newListExpression] = transform(step.listExpression)
    newSteps.push(
      new ForStepAST(
        step.steps,
        step.loopVariableName,
        newListExpression,
        step.indexVariableName,
        step.rangeStart,
        step.rangeEnd,
        step.label,
      ),
    )
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsRaise(
  step: RaiseStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.value) {
    const [newSteps, newEx] = transform(step.value)
    newSteps.push(new RaiseStepAST(newEx, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsReturn(
  step: ReturnStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.value) {
    const [newSteps, newEx] = transform(step.value)
    newSteps.push(new ReturnStepAST(newEx, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsSwitch(
  step: SwitchStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  const newSteps: WorkflowStepAST[] = []
  const newBranches = step.branches.map((cond) => {
    const [steps2, ex2] = transform(cond.condition)
    newSteps.push(...steps2)

    return {
      condition: ex2,
      steps: cond.steps,
      next: cond.next,
    }
  })

  newSteps.push(new SwitchStepAST(newBranches, step.label))
  return newSteps
}

function transformExpression(
  ex: Expression,
  transform: ExpressionTransformer,
): Expression {
  const transformed = transform(ex)

  if (transformed !== Unmodified) {
    // Use the transformed version of this term
    return transformed
  } else {
    // Otherwise, recurse into the nested expression
    switch (ex.expressionType) {
      case 'primitive':
        if (isLiteral(ex)) {
          return ex
        } else {
          const newPrimitive = transformPrimitive(ex.value, transform)
          return newPrimitive === ex.value
            ? ex
            : new PrimitiveExpression(newPrimitive)
        }

      case 'binary':
        return transformBinaryExpression(ex, transform)

      case 'functionInvocation':
        return transformFunctionInvocationExpression(ex, transform)

      case 'member':
        return transformMemberExpression(ex, transform)

      case 'unary':
        return transformUnaryExpression(ex, transform)

      case 'variableReference':
        return ex
    }
  }
}

function transformPrimitive(
  val: Primitive,
  transform: ExpressionTransformer,
): Primitive {
  const tranformVal = R.ifElse(
    isExpression,
    (x) => transformExpression(x, transform),
    (x) => transformPrimitive(x, transform),
  )

  if (Array.isArray(val)) {
    return val.map(tranformVal)
  } else if (isRecord(val)) {
    return mapRecordValues(val, tranformVal)
  } else {
    return val
  }
}

function transformBinaryExpression(
  ex: BinaryExpression,
  transform: ExpressionTransformer,
): BinaryExpression {
  // Transform left first to keep the correct order of execution of sub-expressions
  const newLeft = transformExpression(ex.left, transform)
  const newRight = transformExpression(ex.right, transform)

  if (newLeft === ex.left && newRight === ex.right) {
    return ex
  } else {
    return new BinaryExpression(newLeft, ex.binaryOperator, newRight)
  }
}

function transformFunctionInvocationExpression(
  ex: FunctionInvocationExpression,
  transform: ExpressionTransformer,
): FunctionInvocationExpression {
  const newArguments = ex.arguments.map((x) =>
    transformExpression(x, transform),
  )
  if (newArguments.every((x, i) => x === ex.arguments[i])) {
    return ex
  } else {
    return new FunctionInvocationExpression(ex.functionName, newArguments)
  }
}

function transformMemberExpression(
  ex: MemberExpression,
  transform: ExpressionTransformer,
): Expression {
  const newObject = transformExpression(ex.object, transform)
  const newProperty = transformExpression(ex.property, transform)

  if (newObject === ex.object && newProperty === ex.property) {
    return ex
  } else {
    return new MemberExpression(newObject, newProperty, ex.computed)
  }
}

function transformUnaryExpression(
  ex: UnaryExpression,
  transform: ExpressionTransformer,
): Expression {
  const newValue = transformExpression(ex.value, transform)
  return newValue === ex.value ? ex : new UnaryExpression(ex.operator, newValue)
}

/**
 * Search for map literals in expressions and replace them with assign step + variable.
 *
 * Workflows does not support a map literal in expressions.
 *
 * For example, transforms this:
 *
 * - return1:
 *     return: ${ {value: 5}.value }
 *
 * into this:
 *
 * - assign1:
 *     assign:
 *       - __temp0:
 *         value: 5
 * - return1:
 *     return: ${__temp0.value}
 */
function mapLiteralsAsAssignSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return steps.flatMap((step) =>
    transformStepExpressions(step, transformNestedMaps),
  )
}

function transformNestedMaps(ex: Expression): [WorkflowStepAST[], Expression] {
  const generateTemporaryVariableName = createTempVariableGenerator()
  const { transformedExpression, tempVariables } = extractNestedMaps(
    ex,
    generateTemporaryVariableName,
    0,
  )
  const assignments =
    tempVariables.length > 0 ? [new AssignStepAST(tempVariables)] : []

  return [assignments, transformedExpression]
}

function extractNestedMaps(
  ex: Expression,
  generateName: () => string,
  nestingLevel: number,
): { transformedExpression: Expression; tempVariables: VariableAssignment[] } {
  switch (ex.expressionType) {
    case 'primitive':
      return extractNestedMapPrimitive(ex.value, generateName, nestingLevel)

    case 'binary':
      return extractNestedMapBinary(ex, generateName, nestingLevel)

    case 'variableReference':
      return { transformedExpression: ex, tempVariables: [] }

    case 'functionInvocation':
      return extractNestedMapFunctionInvocation(ex, generateName, nestingLevel)

    case 'member':
      return extractNestedMapMember(ex, generateName, nestingLevel)

    case 'unary':
      return extractNestedMapUnary(ex, generateName, nestingLevel)
  }
}

function extractNestedMapPrimitive(
  primitiveEx: Primitive,
  generateName: () => string,
  nestingLevel: number,
): { transformedExpression: Expression; tempVariables: VariableAssignment[] } {
  const { transformed, tempVariables } = extractNestedMapPrimitiveRecursive(
    primitiveEx,
    generateName,
    nestingLevel,
  )
  const ex = isExpression(transformed)
    ? transformed
    : new PrimitiveExpression(transformed)

  return {
    transformedExpression: ex,
    tempVariables,
  }
}

function extractNestedMapPrimitiveRecursive(
  primitiveEx: Primitive,
  generateName: () => string,
  nestingLevel: number,
): {
  transformed: Expression | Primitive
  tempVariables: VariableAssignment[]
} {
  if (
    typeof primitiveEx === 'string' ||
    typeof primitiveEx === 'number' ||
    typeof primitiveEx === 'boolean' ||
    primitiveEx === null
  ) {
    return {
      transformed: primitiveEx,
      tempVariables: [],
    }
  } else if (Array.isArray(primitiveEx)) {
    return extractMapsInList(primitiveEx, generateName, nestingLevel)
  } else {
    return extractMapsInMap(primitiveEx, generateName, nestingLevel)
  }
}

function extractMapsInList(
  primitiveEx: (Primitive | Expression)[],
  generateName: () => string,
  nestingLevel: number,
) {
  const { tempVariables, elements } = primitiveEx.reduce(
    (acc, val) => {
      if (isExpression(val)) {
        const { transformedExpression, tempVariables: temps } =
          extractNestedMaps(val, generateName, nestingLevel)
        acc.tempVariables.push(...temps)
        acc.elements.push(transformedExpression)
      } else {
        const { transformed, tempVariables: temps } =
          extractNestedMapPrimitiveRecursive(val, generateName, nestingLevel)
        acc.tempVariables.push(...temps)
        acc.elements.push(transformed)
      }

      return acc
    },
    {
      tempVariables: [] as VariableAssignment[],
      elements: [] as (Expression | Primitive)[],
    },
  )

  return {
    tempVariables,
    transformed: elements,
  }
}

function extractMapsInMap(
  primitiveEx: Record<string, Primitive | Expression>,
  generateName: () => string,
  nestingLevel: number,
) {
  const { tempVariables, properties } = Object.entries(primitiveEx).reduce(
    (acc, [key, val]) => {
      if (isExpression(val)) {
        const { transformedExpression, tempVariables: temps } =
          extractNestedMaps(val, generateName, 0)
        acc.tempVariables.push(...temps)
        acc.properties[key] = transformedExpression
      } else {
        const { transformed, tempVariables: temps } =
          extractNestedMapPrimitiveRecursive(val, generateName, 0)
        acc.tempVariables.push(...temps)
        acc.properties[key] = transformed
      }

      return acc
    },
    {
      tempVariables: [] as VariableAssignment[],
      properties: {} as Record<string, Expression | Primitive>,
    },
  )

  let newValue
  if (nestingLevel === 0) {
    newValue = properties
  } else {
    const name = generateName()
    tempVariables.push([name, new PrimitiveExpression(properties)])
    newValue = new VariableReferenceExpression(name)
  }

  return {
    transformed: newValue,
    tempVariables,
  }
}

function extractNestedMapFunctionInvocation(
  ex: FunctionInvocationExpression,
  generateName: () => string,
  nestingLevel: number,
) {
  const { expressions, temps } = ex.arguments.reduce(
    (acc, arg) => {
      const { transformedExpression, tempVariables } = extractNestedMaps(
        arg,
        generateName,
        nestingLevel + 1,
      )
      acc.expressions.push(transformedExpression)
      acc.temps.push(...tempVariables)
      return acc
    },
    { expressions: [] as Expression[], temps: [] as VariableAssignment[] },
  )

  return {
    transformedExpression: new FunctionInvocationExpression(
      ex.functionName,
      expressions,
    ),
    tempVariables: temps,
  }
}

function extractNestedMapBinary(
  ex: BinaryExpression,
  generateName: () => string,
  nestingLevel: number,
) {
  const left = extractNestedMaps(ex.left, generateName, nestingLevel + 1)
  const right = extractNestedMaps(ex.right, generateName, nestingLevel + 1)

  return {
    transformedExpression: new BinaryExpression(
      left.transformedExpression,
      ex.binaryOperator,
      right.transformedExpression,
    ),
    tempVariables: left.tempVariables.concat(right.tempVariables),
  }
}

function extractNestedMapMember(
  ex: MemberExpression,
  generateName: () => string,
  nestingLevel: number,
) {
  const obj = extractNestedMaps(ex.object, generateName, nestingLevel + 1)
  const pr = extractNestedMaps(ex.property, generateName, nestingLevel + 1)

  return {
    transformedExpression: new MemberExpression(
      obj.transformedExpression,
      pr.transformedExpression,
      ex.computed,
    ),
    tempVariables: obj.tempVariables.concat(pr.tempVariables),
  }
}

function extractNestedMapUnary(
  ex: UnaryExpression,
  generateName: () => string,
  nestingLevel: number,
) {
  const { transformedExpression, tempVariables } = extractNestedMaps(
    ex.value,
    generateName,
    nestingLevel,
  )

  return {
    transformedExpression: new UnaryExpression(
      ex.operator,
      transformedExpression,
    ),
    tempVariables,
  }
}

/**
 * Replace `Array.isArray(x)` with `get_type(x) == "list"`
 */
function runtimeFunctionImplementation(
  steps: WorkflowStepAST[],
): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const transformedSteps = transformStepExpressions(current, (ex) => [
      [],
      transformExpression(ex, replaceIsArray),
    ])
    acc.push(...transformedSteps)

    return acc
  }, [])
}

function replaceIsArray(ex: Expression): Expression | Unmodified {
  if (
    ex.expressionType === 'functionInvocation' &&
    ex.functionName === 'Array.isArray'
  ) {
    return new BinaryExpression(
      new FunctionInvocationExpression('get_type', ex.arguments),
      '==',
      new PrimitiveExpression('list'),
    )
  } else {
    return Unmodified
  }
}
