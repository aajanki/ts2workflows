import * as R from 'ramda'
import { InternalTranspilingError } from '../errors.js'
import {
  binaryEx,
  BinaryExpression,
  Expression,
  functionInvocationEx,
  FunctionInvocationExpression,
  listEx,
  ListExpression,
  mapEx,
  MapExpression,
  memberEx,
  MemberExpression,
  stringEx,
  unaryEx,
  UnaryExpression,
  variableReferenceEx,
} from '../ast/expressions.js'
import {
  applyNested,
  AssignStatement,
  DoWhileStatement,
  ForRangeStatement,
  ForStatement,
  FunctionInvocationStatement,
  IfStatement,
  LabelledStatement,
  RaiseStatement,
  ReturnStatement,
  SwitchStatement,
  VariableAssignment,
  WhileStatement,
  WorkflowStatement,
} from '../ast/statements.js'
import { blockingFunctions } from './generated/functionMetadata.js'

/**
 * Performs various transformations on the AST.
 */
export function transformAST(
  statements: WorkflowStatement[],
): WorkflowStatement[] {
  const tempGen = createTempVariableGenerator()
  const transform = R.pipe(
    R.chain(mapLiteralsAsAssigns(tempGen)),
    mergeAssigns,
    R.chain(intrinsicFunctionImplementation),
    R.chain(blockingCallsAsFunctionCalls(tempGen)),
  )

  return transform(statements.map((s) => applyNested(transformAST, s)))
}

/**
 * Merge consecutive assign statements into one assign statement
 *
 * An assign is allowed to contain up to 50 assignments.
 */
function mergeAssigns(statements: WorkflowStatement[]): WorkflowStatement[] {
  return statements.reduce(
    (acc: WorkflowStatement[], current: WorkflowStatement) => {
      const prev = acc.length > 0 ? acc[acc.length - 1] : null

      let prevAssignments = undefined
      let label = undefined
      if (prev?.tag === 'assign') {
        prevAssignments = prev.assignments
      } else if (
        prev?.tag === 'label' &&
        prev.statements.every((x) => x.tag === 'assign')
      ) {
        prevAssignments = prev.statements.flatMap((x) => x.assignments)
        label = prev.label
      }

      let currentAssignments = undefined
      if (current.tag === 'assign') {
        currentAssignments = current.assignments
      } else if (
        current.tag === 'label' &&
        current.statements.every((x) => x.tag === 'assign')
      ) {
        currentAssignments = current.statements.flatMap((x) => x.assignments)
        label ??= current.label
      }

      if (prevAssignments && currentAssignments) {
        let merged: AssignStatement | LabelledStatement = new AssignStatement(
          prevAssignments.concat(currentAssignments),
        )
        if (label) {
          merged = new LabelledStatement(label, [merged])
        }
        acc.pop()
        acc.push(merged)
      } else {
        acc.push(current)
      }

      return acc
    },
    [],
  )
}

/**
 * Transform expressions in a statement by applying transform.
 *
 * Returns an array of statements. The array includes the transformed statement
 * and possibly additional statements constructed during the transformation.
 * For example, a transformation might extract blocking call expressions into
 * function call.
 */
const expandExpressionToStatements = R.curry(function (
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: WorkflowStatement,
): WorkflowStatement[] {
  switch (statement.tag) {
    case 'assign':
      return expandAssign(transform, statement)

    case 'function-invocation':
      return expandFunctionInvocation(transform, statement)

    case 'for':
      return expandFor(transform, statement)

    case 'for-range':
      return expandForRange(transform, statement)

    case 'if':
      return expandIf(transform, statement)

    case 'raise':
      return expandRaise(transform, statement)

    case 'return':
      return expanrdReturn(transform, statement)

    case 'switch':
      return expandSwitch(transform, statement)

    case 'while':
    case 'do-while':
      return expandWhile(transform, statement)

    case 'break':
    case 'continue':
    case 'label':
    case 'parallel':
    case 'parallel-for':
    case 'try':
      return [statement]
  }
})

function expandAssign(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: AssignStatement,
): WorkflowStatement[] {
  const newStatements: WorkflowStatement[] = []
  const newAssignments = statement.assignments.map(({ name, value }) => {
    const [st2, transformedKey] = transform(name)
    const [st3, transformedValue] = transform(value)
    newStatements.push(...st2)
    newStatements.push(...st3)

    if (
      transformedKey.tag !== 'variableReference' &&
      transformedKey.tag !== 'member'
    ) {
      throw new InternalTranspilingError(
        'Unexpected key type when transforming an assignment',
      )
    }

    return { name: transformedKey, value: transformedValue }
  })
  newStatements.push({ ...statement, assignments: newAssignments })
  return newStatements
}

function expandFunctionInvocation(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: FunctionInvocationStatement,
): WorkflowStatement[] {
  if (statement.args) {
    const newStatements: WorkflowStatement[] = []
    const newArgs = R.map((ex) => {
      const [st2, ex2] = transform(ex)
      newStatements.push(...st2)
      return ex2
    }, statement.args)
    newStatements.push({ ...statement, args: newArgs })
    return newStatements
  } else {
    return [statement]
  }
}

function expandFor(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: ForStatement,
): WorkflowStatement[] {
  const [res, newListExpression] = transform(statement.listExpression)
  res.push({ ...statement, listExpression: newListExpression })
  return res
}

function expandForRange(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: ForRangeStatement,
): WorkflowStatement[] {
  const res: WorkflowStatement[] = []
  let newRangeStart: number | Expression
  let newRangeEnd: number | Expression

  if (typeof statement.rangeStart === 'number') {
    newRangeStart = statement.rangeStart
  } else {
    const [st1, ex1] = transform(statement.rangeStart)
    res.push(...st1)
    newRangeStart = ex1
  }

  if (typeof statement.rangeEnd === 'number') {
    newRangeEnd = statement.rangeEnd
  } else {
    const [st2, ex2] = transform(statement.rangeEnd)
    res.push(...st2)
    newRangeEnd = ex2
  }

  res.push({ ...statement, rangeStart: newRangeStart, rangeEnd: newRangeEnd })

  return res
}

function expandIf(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: IfStatement,
): WorkflowStatement[] {
  const res: WorkflowStatement[] = []
  const newBranches = statement.branches.map((branch) => {
    const [st, ex] = transform(branch.condition)

    res.push(...st)

    return {
      ...branch,
      condition: ex,
    }
  })

  res.push(new IfStatement(newBranches))

  return res
}

function expandRaise(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: RaiseStatement,
): WorkflowStatement[] {
  const [res, newEx] = transform(statement.value)
  res.push({ ...statement, value: newEx })
  return res
}

function expanrdReturn(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: ReturnStatement,
): WorkflowStatement[] {
  if (statement.value) {
    const [newStatements, newEx] = transform(statement.value)
    newStatements.push({ ...statement, value: newEx })
    return newStatements
  } else {
    return [statement]
  }
}

function expandSwitch(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: SwitchStatement,
): WorkflowStatement[] {
  const res: WorkflowStatement[] = []
  const newBranches = statement.branches.map((branch) => {
    const [st2, ex2] = transform(branch.condition)
    res.push(...st2)

    return {
      condition: ex2,
      body: branch.body,
    }
  })
  res.push({ ...statement, branches: newBranches })
  return res
}

function expandWhile(
  transform: (ex: Expression) => [WorkflowStatement[], Expression],
  statement: WhileStatement | DoWhileStatement,
): WorkflowStatement[] {
  const [res, newCond] = transform(statement.condition)
  res.push({ ...statement, condition: newCond })

  return res
}

function createTempVariableGenerator(): () => string {
  let i = 0
  return () => `__temp${i++}`
}

function replaceBlockingCalls(
  generateName: () => string,
  expression: Expression,
): [FunctionInvocationStatement[], Expression] {
  function replaceBlockingFunctionInvocations(ex: Expression): Expression {
    if (ex.tag !== 'functionInvocation') {
      return ex
    }

    const blockingCallArgumentNames = blockingFunctions.get(ex.functionName)
    if (blockingCallArgumentNames) {
      const nameAndValue = R.zip(blockingCallArgumentNames, ex.arguments)
      const callArgs = R.fromPairs(nameAndValue)
      const tempCallResultVariable = generateName()

      callStatements.push(
        new FunctionInvocationStatement(
          ex.functionName,
          callArgs,
          tempCallResultVariable,
        ),
      )

      // replace function invocation with a reference to the temporary variable
      return variableReferenceEx(tempCallResultVariable)
    } else {
      return ex
    }
  }

  const callStatements: FunctionInvocationStatement[] = []

  return [
    callStatements,
    transformExpression(replaceBlockingFunctionInvocations, expression),
  ]
}

/**
 * Search for blocking calls in expressions and replace them with a call + variable.
 *
 * The Workflows runtime requires that blocking calls must be executed by a call step.
 *
 * For example, transforms this:
 *
 * ```yaml
 * - return1:
 *     return: ${http.get("https://example.com")}
 * ```
 *
 * into this:
 *
 * ```yaml
 * - call_http_get_1:
 *     call: http.get
 *     args:
 *       url: https://example.com
 *     result: __temp0
 * - return1:
 *     return: ${__temp0}
 * ```
 */
function blockingCallsAsFunctionCalls(generateTempName: () => string) {
  return (statement: WorkflowStatement): WorkflowStatement[] => {
    return expandExpressionToStatements(
      (ex) => replaceBlockingCalls(generateTempName, ex),
      statement,
    )
  }
}

/**
 * Apply transform to expressions recursively.
 * Transform leaf expressions first.
 */
function transformExpression(
  transform: (x: Expression) => Expression,
  ex: Expression,
): Expression {
  const nestedTr = (y: Expression) => transformExpression(transform, y)

  switch (ex.tag) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
    case 'variableReference':
      return transform(ex)

    case 'list':
      return transform(listEx(R.map(nestedTr, ex.value)))

    case 'map':
      return transform(mapEx(R.map(nestedTr, ex.value)))

    case 'binary':
      return transform(
        binaryEx(nestedTr(ex.left), ex.binaryOperator, nestedTr(ex.right)),
      )

    case 'functionInvocation':
      return transform(
        functionInvocationEx(ex.functionName, ex.arguments.map(nestedTr)),
      )

    case 'member':
      return transform(
        memberEx(nestedTr(ex.object), nestedTr(ex.property), ex.computed),
      )

    case 'unary':
      return transform(unaryEx(ex.operator, nestedTr(ex.value)))
  }
}

/**
 * Search for map literals in expressions and replace them with assign + variable.
 *
 * Workflows does not support a map literal in expressions.
 *
 * For example, transforms this:
 *
 * ```yaml
 * - return1:
 *     return: ${ {value: 5}.value }
 * ```
 *
 * into this:
 *
 * ```yaml
 * - assign1:
 *     assign:
 *       - __temp0:
 *           value: 5
 * - return1:
 *     return: ${__temp0.value}
 * ```
 */
function mapLiteralsAsAssigns(generateTempName: () => string) {
  return (statement: WorkflowStatement): WorkflowStatement[] => {
    return expandExpressionToStatements(
      (ex) => transformNestedMaps(generateTempName, ex),
      statement,
    )
  }
}

function transformNestedMaps(
  generateTempName: () => string,
  ex: Expression,
): [AssignStatement[], Expression] {
  const { transformedExpression, tempVariables } = extractNestedMaps(
    ex,
    generateTempName,
    0,
  )
  const assignments =
    tempVariables.length > 0 ? [new AssignStatement(tempVariables)] : []

  return [assignments, transformedExpression]
}

function extractNestedMaps(
  ex: Expression,
  generateName: () => string,
  nestingLevel: number,
): { transformedExpression: Expression; tempVariables: VariableAssignment[] } {
  switch (ex.tag) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
    case 'variableReference':
      return { transformedExpression: ex, tempVariables: [] }

    case 'list':
      return extractMapsInList(ex, generateName, nestingLevel)

    case 'map':
      return extractMapsInMap(ex, generateName, nestingLevel)

    case 'binary':
      return extractNestedMapBinary(ex, generateName, nestingLevel)

    case 'functionInvocation':
      return extractNestedMapFunctionInvocation(ex, generateName, nestingLevel)

    case 'member':
      return extractNestedMapMember(ex, generateName, nestingLevel)

    case 'unary':
      return extractNestedMapUnary(ex, generateName, nestingLevel)
  }
}

function extractMapsInList(
  list: ListExpression,
  generateName: () => string,
  nestingLevel: number,
) {
  const tempVariables: VariableAssignment[] = []
  const elements: Expression[] = []

  list.value.forEach((val) => {
    const { transformedExpression, tempVariables: temps } = extractNestedMaps(
      val,
      generateName,
      nestingLevel,
    )

    tempVariables.push(...temps)
    elements.push(transformedExpression)
  })

  return {
    tempVariables,
    transformedExpression: listEx(elements),
  }
}

function extractMapsInMap(
  map: MapExpression,
  generateName: () => string,
  nestingLevel: number,
) {
  const { tempVariables, properties } = Object.entries(map.value).reduce(
    (acc, [key, val]) => {
      const { transformedExpression, tempVariables: temps } = extractNestedMaps(
        val,
        generateName,
        0,
      )
      acc.tempVariables.push(...temps)
      acc.properties[key] = transformedExpression

      return acc
    },
    {
      tempVariables: [] as VariableAssignment[],
      properties: {} as Record<string, Expression>,
    },
  )

  let newValue: Expression
  if (nestingLevel === 0) {
    newValue = mapEx(properties)
  } else {
    newValue = variableReferenceEx(generateName())
    tempVariables.push({
      name: newValue,
      value: mapEx(properties),
    })
  }

  return {
    transformedExpression: newValue,
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
    transformedExpression: functionInvocationEx(ex.functionName, expressions),
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
    transformedExpression: binaryEx(
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
    transformedExpression: memberEx(
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
    transformedExpression: unaryEx(ex.operator, transformedExpression),
    tempVariables,
  }
}

/**
 * Replace `Array.isArray(x)` with `get_type(x) == "list"`
 */
const intrinsicFunctionImplementation = expandExpressionToStatements((ex) => [
  [],
  transformExpression(replaceIsArray, ex),
])

function replaceIsArray(ex: Expression): Expression {
  if (ex.tag === 'functionInvocation' && ex.functionName === 'Array.isArray') {
    return binaryEx(
      functionInvocationEx('get_type', ex.arguments),
      '==',
      stringEx('list'),
    )
  } else {
    return ex
  }
}
