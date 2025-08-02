import {
  Expression,
  MemberExpression,
  VariableName,
  VariableReferenceExpression,
} from './expressions.js'
import { StepName } from './steps.js'

export type WorkflowParameters = Record<VariableName, Expression>

export interface VariableAssignment {
  name: VariableReferenceExpression | MemberExpression
  value: Expression
}

// According to the documentation
// (https://cloud.google.com/workflows/docs/reference/syntax/retrying#try-retry)
// all parameters are required, but in practice they can be left out.
// Perhaps Workflows substitutes some default values?
// Values are expected to be numbers or number valued expressions. Strings
// are apparently accepted, too, and probably coerced to numbers.
export interface CustomRetryPolicy {
  predicate?: string
  maxRetries: Expression
  backoff: {
    initialDelay?: Expression
    maxDelay?: Expression
    multiplier?: Expression
  }
}

export class AssignStatement {
  readonly tag = 'assign'

  constructor(public readonly assignments: VariableAssignment[]) {}
}

export class BreakStatement {
  readonly tag = 'break'

  constructor(public readonly label?: string) {}
}

export class ContinueStatement {
  readonly tag = 'continue'

  constructor(public readonly label?: string) {}
}

export class ForStatement {
  readonly tag = 'for'

  constructor(
    public readonly body: WorkflowStatement[],
    public readonly loopVariableName: VariableName,
    public readonly listExpression: Expression,
    public readonly indexVariableName?: VariableName,
  ) {}
}

export class ForRangeStatement {
  readonly tag = 'for-range'

  constructor(
    public readonly body: WorkflowStatement[],
    public readonly loopVariableName: VariableName,
    public readonly rangeStart: number | Expression,
    public readonly rangeEnd: number | Expression,
  ) {}
}

export class FunctionInvocationStatement {
  readonly tag = 'function-invocation'

  constructor(
    public readonly callee: string,
    public readonly args?: WorkflowParameters,
    public readonly result?: VariableName,
  ) {}
}

export interface IfBranch {
  readonly condition: Expression
  readonly body: WorkflowStatement[]
}

export interface IfNextBranch {
  readonly condition: Expression
  readonly next: StepName
}

export class IfStatement {
  readonly tag = 'if'

  constructor(public readonly branches: (IfBranch | IfNextBranch)[]) {}
}

export interface ParallelBranch {
  readonly name: string
  readonly body: WorkflowStatement[]
}

export class ParallelStatement {
  readonly tag = 'parallel'

  constructor(
    public readonly branches: ParallelBranch[],
    public readonly shared?: VariableName[],
    public readonly concurrencyLimit?: number,
    public readonly exceptionPolicy?: string,
  ) {}
}

export class ParallelForStatement {
  readonly tag = 'parallel-for'

  constructor(
    public readonly forStep: ForStatement | ForRangeStatement,
    public readonly shared?: VariableName[],
    public readonly concurrencyLimit?: number,
    public readonly exceptionPolicy?: string,
  ) {}
}

export class RaiseStatement {
  readonly tag = 'raise'

  constructor(public readonly value: Expression) {}
}

export class ReturnStatement {
  readonly tag = 'return'

  constructor(public readonly value: Expression | undefined) {}
}

export class SwitchStatement {
  readonly tag = 'switch'

  constructor(public readonly branches: IfBranch[]) {}
}

export class TryStatement {
  readonly tag = 'try'

  constructor(
    public readonly tryBody: WorkflowStatement[],
    public readonly exceptBody?: WorkflowStatement[],
    public readonly retryPolicy?: string | CustomRetryPolicy,
    public readonly errorMap?: VariableName,
    public readonly finalizerBody?: WorkflowStatement[],
  ) {}
}

export class WhileStatement {
  readonly tag = 'while'

  constructor(
    public readonly condition: Expression,
    public readonly body: WorkflowStatement[],
  ) {}
}

export class DoWhileStatement {
  readonly tag = 'do-while'

  constructor(
    public readonly condition: Expression,
    public readonly body: WorkflowStatement[],
  ) {}
}

export class LabelledStatement {
  readonly tag = 'label'

  constructor(
    public readonly label: string,
    public readonly statements: WorkflowStatement[],
  ) {}
}

export type WorkflowStatement =
  | AssignStatement
  | BreakStatement
  | ContinueStatement
  | DoWhileStatement
  | ForStatement
  | ForRangeStatement
  | FunctionInvocationStatement
  | IfStatement
  | LabelledStatement
  | ParallelForStatement
  | ParallelStatement
  | RaiseStatement
  | ReturnStatement
  | SwitchStatement
  | TryStatement
  | WhileStatement

export function applyNested(
  fn: (x: WorkflowStatement[]) => WorkflowStatement[],
  s: WorkflowStatement,
): WorkflowStatement {
  switch (s.tag) {
    case 'assign':
    case 'break':
    case 'continue':
    case 'function-invocation':
    case 'raise':
    case 'return':
      return s

    case 'do-while':
      return new DoWhileStatement(s.condition, fn(s.body))

    case 'for':
      return new ForStatement(
        fn(s.body),
        s.loopVariableName,
        s.listExpression,
        s.indexVariableName,
      )

    case 'for-range':
      return new ForRangeStatement(
        fn(s.body),
        s.loopVariableName,
        s.rangeStart,
        s.rangeEnd,
      )

    case 'if':
      return new IfStatement(
        s.branches.map((b) =>
          'body' in b
            ? {
                condition: b.condition,
                body: fn(b.body),
              }
            : b,
        ),
      )

    case 'label':
      return new LabelledStatement(s.label, fn(s.statements))

    case 'parallel-for':
      return new ParallelForStatement(
        applyNested(fn, s.forStep) as ForStatement | ForRangeStatement, // FIXME typing
        s.shared,
        s.concurrencyLimit,
        s.exceptionPolicy,
      )

    case 'parallel':
      return new ParallelStatement(
        s.branches.map((b) => ({
          name: b.name,
          body: fn(b.body),
        })),
        s.shared,
        s.concurrencyLimit,
        s.exceptionPolicy,
      )

    case 'switch':
      return new SwitchStatement(
        s.branches.map((b) => ({
          condition: b.condition,
          body: fn(b.body),
        })),
      )

    case 'try':
      return new TryStatement(
        fn(s.tryBody),
        s.exceptBody ? fn(s.exceptBody) : undefined,
        s.retryPolicy,
        s.errorMap,
        s.finalizerBody ? fn(s.finalizerBody) : undefined,
      )

    case 'while':
      return new WhileStatement(s.condition, fn(s.body))
  }
}
