import {
  Expression,
  MemberExpression,
  VariableName,
  VariableReferenceExpression,
} from './expressions.js'
import { Label } from './steps.js'

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
  public readonly tag = 'assign'

  public constructor(public readonly assignments: VariableAssignment[]) {}
}

export class BreakStatement {
  public readonly tag = 'break'

  public constructor(public readonly label?: Label) {}
}

export class ContinueStatement {
  public readonly tag = 'continue'

  public constructor(public readonly label?: Label) {}
}

export class ForStatement {
  public readonly tag = 'for'

  public constructor(
    public readonly body: WorkflowStatement[],
    public readonly loopVariableName: VariableName,
    public readonly listExpression: Expression,
    public readonly indexVariableName?: VariableName,
  ) {}

  public withListExpression(ex: Expression): ForStatement {
    return new ForStatement(
      this.body,
      this.loopVariableName,
      ex,
      this.indexVariableName,
    )
  }
}

export class ForRangeStatement {
  public readonly tag = 'for-range'

  public constructor(
    public readonly body: WorkflowStatement[],
    public readonly loopVariableName: VariableName,
    public readonly rangeStart: number | Expression,
    public readonly rangeEnd: number | Expression,
  ) {}

  public withRange(
    start: number | Expression,
    end: number | Expression,
  ): ForRangeStatement {
    return new ForRangeStatement(this.body, this.loopVariableName, start, end)
  }
}

export class FunctionInvocationStatement {
  public readonly tag = 'function-invocation'

  public constructor(
    public readonly callee: string,
    public readonly args?: WorkflowParameters,
    public readonly result?: VariableName,
  ) {}

  public withArguments(
    newArgs: WorkflowParameters,
  ): FunctionInvocationStatement {
    return new FunctionInvocationStatement(this.callee, newArgs, this.result)
  }
}

export interface IfBranch {
  readonly condition: Expression
  readonly body: WorkflowStatement[]
}

export interface IfNextBranch {
  readonly condition: Expression
  readonly next: Label
}

export class IfStatement {
  public readonly tag = 'if'

  public constructor(public readonly branches: (IfBranch | IfNextBranch)[]) {}
}

export interface ParallelBranch {
  readonly name: Label
  readonly body: WorkflowStatement[]
}

export class ParallelStatement {
  public readonly tag = 'parallel'

  public constructor(
    public readonly branches: ParallelBranch[],
    public readonly shared?: VariableName[],
    public readonly concurrencyLimit?: number,
    public readonly exceptionPolicy?: string,
  ) {}
}

export class ParallelForStatement {
  public readonly tag = 'parallel-for'

  public constructor(
    public readonly forStep: ForStatement | ForRangeStatement,
    public readonly shared?: VariableName[],
    public readonly concurrencyLimit?: number,
    public readonly exceptionPolicy?: string,
  ) {}
}

export class RaiseStatement {
  public readonly tag = 'raise'

  public constructor(public readonly value: Expression) {}
}

export class ReturnStatement {
  public readonly tag = 'return'

  public constructor(public readonly value: Expression | undefined) {}
}

export class SwitchStatement {
  public readonly tag = 'switch'

  public constructor(public readonly branches: IfBranch[]) {}
}

export class TryStatement {
  public readonly tag = 'try'

  public constructor(
    public readonly tryBody: WorkflowStatement[],
    public readonly exceptBody?: WorkflowStatement[],
    public readonly retryPolicy?: string | CustomRetryPolicy,
    public readonly errorMap?: VariableName,
    public readonly finalizerBody?: WorkflowStatement[],
  ) {}
}

export class WhileStatement {
  public readonly tag = 'while'

  public constructor(
    public readonly condition: Expression,
    public readonly body: WorkflowStatement[],
  ) {}

  public withCondition(newCondition: Expression): WhileStatement {
    return new WhileStatement(newCondition, this.body)
  }
}

export class DoWhileStatement {
  public readonly tag = 'do-while'

  public constructor(
    public readonly condition: Expression,
    public readonly body: WorkflowStatement[],
  ) {}

  public withCondition(newCondition: Expression): DoWhileStatement {
    return new DoWhileStatement(newCondition, this.body)
  }
}

export class LabelledStatement {
  public readonly tag = 'label'

  public constructor(
    public readonly label: Label,
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
        // oxlint-disable-next-line no-unsafe-type-assertion
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
