# Language reference

ts2workflow converts Typescript source code to GCP Workflows YAML syntax. Only a subset of Typescript language features are supported. This page documents supported Typescript features and shows examples of how Typescript code snippets look when converted to Workflows YAML.

Most functions provided by a Javascript runtime (`console.log()`, `setInterval()`, etc) are not available.

One of the benefits of writing workflows on Typescript is that the source code can be type checked and potential, and potential problems can be caught early. Type checking can be done with the standard Typescript compiler tsc. ts2workflows itself ignores all types, and types don't affect the generated Workflows YAML.

Semicolon can be used as optional statement delimitter.

⚠️ Semantics of certain operations in GCP Workflows are different from Typescript semantics. These differences are highlighted with the warning icon ⚠️ on this documentation.

## Data types

- `number`: Integer (64 bit, signed) or double (64 bit, signed floating point number)
- `string`: `"my beautiful string"`, both single or double quotes are accepted
- `boolean`: `true`/`false`
- `bytes`
- `null`
- Array: `[1, 2, 3]`
- Map: `{temperature: -12, unit: "Celsius"}`

The Typescript type alias `WorkflowsValue` (provided by `ts2workflows/types/workflowslib`) represents any valid Workflows value. Sample usage:

```typescript
import { WorkflowsValue } from 'ts2workflows/types/workflowslib'

const x: WorkflowsValue = [1, 2]
```

### Array type

⚠️ Arrays are not objects in GCP Workflows. In particular, methods like `[].map()` and `[].concat()` are not available.

⚠️ Accessing out-of-bounds index will cause an IndexError at runtime unlike in Typescript where out-of-bounds access would return `undefined`.

### Map type

Map keys can be identifiers or strings: `{temperature: -12}` or `{"temperature": -12}`. Trailing commas are allowed.

⚠️ Trying to access a non-existing member of an object will throw a KeyError at runtime, unlike in Typescript where it would return `undefined`.

### Bytes type

A `bytes` object can only be constructed by calling a function that returns `bytes` (e.g. `base64.decode`). The only things that can be done with a `bytes` object is to assign it to variable and to pass the `bytes` object to one of the functions that take `bytes` type as input variable (e.g. `base64.encode`).

### null type

`null` is used to signify absence of a value. In addition to the literal `null`, ts2workflows also translates the Typescript `undefined` to `null` in Workflows YAML output.

Note that `null` and `undefined` still are distinct types on the type checking step.

### Implicit type conversions

Expressions that combine variables with operators such as `+`, `>`, `==` perform implict type conversions according to the [rules listed on GCP Workflows documentation](https://cloud.google.com/workflows/docs/reference/syntax/datatypes#implicit-conversions). For example, applying `+` to a string and a number concatenates the values into a string.

⚠️ Checking if a variable is null or not must be done by an explicit comparison: `if (myVar != null) {...}`. Relying on an implicit conversion (`if (myVvar) {...}` where `myVar` is not a boolean) results in a TypeError at runtime.

## Expressions

Most Typescript expressions work as expected.

Examples:

```javascript
a + b

args.users[3].id

name === 'Bean'

sys.get_env('GOOGLE_CLOUD_PROJECT_ID')
```

## Operators

| Operator     | Description                                        |
| ------------ | -------------------------------------------------- |
| +            | arithmetic addition and string concatenation       |
| -            | arithmetic subtraction or unary negation           |
| \*           | multiplication                                     |
| /            | float division                                     |
| %            | remainder division                                 |
| ==, ===      | equal to (both mean strict equality)               |
| !=, !==      | not equal to (both mean strict equality)           |
| <, >, <=, >= | inequality comparisons                             |
| &&, \|\|, !  | logical and, or, not                               |
| in           | check if a key is present in a map or array        |
| ??           | nullish coalescing                                 |
| ?.           | optional chaining                                  |
| ? :          | conditional operator                               |
| typeof       | return a string representation of the operand type |

The [precendence order of operators](https://cloud.google.com/workflows/docs/reference/syntax/datatypes#order-operations) is the same as in GCP Workflows.

See [the GCP documentation about expressions](https://cloud.google.com/workflows/docs/reference/syntax/expressions) for more information.

### Conditional (ternary) operator

ts2workflows converts the Typescript expression

```javascript
x > 0 ? 'positive' : 'not positive'
```

to an [if() expression](https://cloud.google.com/workflows/docs/reference/stdlib/expression-helpers#conditional_functions):

```yaml
${if(x > 0, "positive", "not positive")}
```

⚠️ Workflows always evaluates both branches unlike Typescript which evaluates only the branch that gets executed.

### Nullish coalescing operator

ts2workflows converts, the Typescript expression

```javascript
x ?? 'default value'
```

to a [default() expression](https://cloud.google.com/workflows/docs/reference/stdlib/expression-helpers#conditional_functions):

```yaml
${default(x, "default value")}
```

⚠️ Workflows always evaluates the right-hand side expression. This is different from Typescript, which evaluates the right-hand side only if the left-hand side is `null` or `undefined`.

### Optional chaining

ts2workflows converts the Typescript optional chaining expression

```javascript
data.user?.name
```

to a [map.get() expression](https://cloud.google.com/workflows/docs/reference/stdlib/map/get):

```yaml
${map.get(data, ["user", "name"])}
```

### in operator

The `in` operator checks if a key is present in a map or if a value is present in a list.

⚠️ The `in` operator applied to a list behaves differently on Workflows than on Typescript. The Workflows `in` operator checks if a value is present in the list, whereas on Typescript `in` checks for the presence of a _property_ on the array object. In particular, the following evaluates to `true` on Workflows (but `false` on Typescript): `"x" in ["x", "y"]`.

### typeof operator

Returns the type of the operand as a string. The return values are the same ones that Javascript typeof operation returns. The following table shows the possible values for different operand types.

| Operand | Result    |
| ------- | --------- |
| boolean | "boolean" |
| bytes   | "object"  |
| double  | "number"  |
| integer | "number"  |
| list    | "object"  |
| map     | "object"  |
| string  | "string"  |
| null    | "object"  |

The typeof operator is useful as a type guard in Typescript (e.g. `typeof x === "string"`). For other use cases, consider the [get_type function](https://cloud.google.com/workflows/docs/reference/stdlib/expression-helpers#type_functions) from the Workflows standard library. It makes finer distinctions between types. It, for example, returns distinct values for lists and maps.

## Template literals

String literals can include interpolated variables. The syntax is same as in Typescript. For example, `Hello ${name}`.

⚠️ Interpolated values can (only) be numbers, strings, booleans or nulls. Other types will throw a TypeError at runtime.

## Variable scopes

Variable scopes are determined by the [GCP Workflows scoping rules](https://cloud.google.com/workflows/docs/reference/syntax/variables#variable-scope).

Variables have function scope, that is they are available in the function where they are defined. Variables defined in `for` and `except` blocks are exceptions; they belong to a local scope of the block in which they are declared.

⚠️ TypeScript has more strict scoping rules. In Typescript, variables declared with `let` or `const` are accessible only on the block in which they are declared (i.e. variable declared inside an if branch cannot be accessed after the if block ends). Programs written according to TypeScript scoping rules always produce valid GCP Workflows programs, too.

Trying to read a variable before it is assigned causes a runtime error.

⚠️ If variable is not initialized at declaration, its value is implicitly set to `null`. For example, the following program will return `null`. (Note that the sample is not valid as a TypeScript program. TypeScript compiler consideres variable `x` to be used before it is assigned.)

```typescript
function main(): void {
  let x: number | null
  return x
}
```

## Subworkflow definitions

ts2workflows converts Typescript `function`s to subworkflow definitions.

The program code must be written inside functions. Only `function` and `import` declarations are allowed on the top level of a source code file. Functions can only be defined at the top level of a source file, not inside other functions.

The workflow execution starts from the subworkflow called "main".

```typescript
function main(): void {
  const a = anotherWorkflow()
}

function anotherWorkflow(): number {
  const b = 10
  return 2 * b
}
```

Subworkflows can have parameters:

```typescript
function multiply(firstFactor: number, secondFactor: number): number {
  return firstFactor * secondFactor
}
```

Optional parameters can be specified with a question mark. If a value is not provided on the call site, the value is set to `null` during the subworkflow execution. The following subworkflow can be called as `greet()` or `greet("Tiabeanie")`.

```typescript
function greet(name?: string): string {
  return 'Hello, ${name ?? "world"}'
}
```

Parameters can have default values. The default value is used if a value is not provided in a subworkflow call. The following subworkflow can be called with one parameter (`log(3)`) or with two parameters (`log(3, 2)`).

```typescript
function log(x: number, base: number = 10) {
  return 'Should compute the logarithm of x'
}
```

### Returning value from a subworkflow

```javascript
return 'Success'
```

The returned value can be an expression:

```javascript
return firstFactor * secondFactor
```

## Calling functions and subworkflows

ts2workflows converts the Typescript statement

```typescript
const projectId = sys.get_env('GOOGLE_CLOUD_PROJECT_ID')
```

to an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step):

```yaml
- assign1:
    assign:
      - projectId: ${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
```

This syntax can be used to call subworkflows (defined with the `function` keyword), [standard library functions](https://cloud.google.com/workflows/docs/reference/stdlib/overview) or connectors. Note that Javascript runtime functions (such as `fetch()`, `console.error()` or `new XMLHttpRequest()`) are not available on Workflows.

GCP Workflows language has two ways of calling functions and subworkflows: as an function call expression or as [call step](https://cloud.google.com/workflows/docs/reference/syntax/calls). They can mostly be used interchangeably. However, [blocking calls](https://cloud.google.com/workflows/docs/reference/syntax/expressions#blocking-calls) must be made as call steps. ts2workflows tries to automatically output a call step when necessary.

It is also possible to force a function to be called as call step. This might be useful, if ts2workflows fails to output call step when it should, or if you want to use named parameters. For example, the following Typescript program

```typescript
import { call_step, sys } from 'ts2workflows/types/workflowslib'

function main() {
  call_step(sys.log, {
    json: { message: 'Hello log' },
    severity: 'INFO',
  })
}
```

is converted to call step:

```yaml
main:
  steps:
    - call1:
        call: sys.log
        args:
          json:
            message: Hello log
          severity: INFO
```

Some Workflows standard library functions have names that are reserved keywords in Typescript. Those functions must be called with alternative syntax in ts2workflows source code:

- To generate a call to `default()` in Workflows code, use the nullish coalescing operator `??`.
- To generete a call to `if()` in Workflows code, use the ternary operator `a ? b : c`.

## Assignments

The statement

```typescript
const name = 'Bean'
```

is converted to an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step):

```yaml
- assign1:
    assign:
      - name: Bean
```

Compound assignments are also supported:

```typescript
total += 1
```

is converted to

```yaml
- assign1:
    assign:
      - total: ${total + 1}
```

## Destructuring

Array destructuring unpacks values from an array or an array expression into variables. The following statements assign the first two values from `arr` to variables `a` and `b`, that is `a` will be `1` and `b` will be `2`.

```typescript
const arr = [1, 2, 3]
const [a, b] = arr
```

Object destructuring unpacks property values from an object into variables. The following statements initializes the variable `person` to `"Bean"` and the variable `name` to the value `"Dreamland"`.

```typescript
const data = { person: 'Bean', country: { name: 'Dreamland' } }
const {
  person,
  country: { name },
} = data
```

Array elements can be skipped:

```typescript
const arr = [1, 2, 3]
const [a, , b] = arr
```

If there are more output variables than elements in the input array, the surplus variables are set to `null`. For example, in the following sample, `a` will be 1 and `b` will be `null`.

```typescript
const arr = [1]
const [a, b] = arr
```

Assignments can have default values:

```typescript
const arr = [1]
const [a, b = 99] = arr
```

⚠️ Setting surplus variables to `null` is different from TypeScript in cases where an array is destructured to elements of itself. The snippet `let arr = [4]; [arr[1], arr[0]] = arr;` will set `arr` to `[null, 4]` in ts2workflows, whereas in TypeScript `arr` would be `[4, 4]`.

The destructuring pattern can end with a rest property `...rest`. The unreferenced array elements are collected to an array called `rest`. The following sample code initializes the variable `rest` to `[3, 4, 5]`.

```typescript
const arr = [1, 2, 3, 4, 5]
const [a, b, ...rest] = arr
```

The rest element can be used also in object destructuring to capture unreferenced properties.

```typescript
const data = { person: 'Bean', country: { name: 'Dreamland' } }
const { person, ...otherProperties } = data
```

## Conditional statements

The statement

```typescript
if (hour < 12) {
  part_of_the_day = 'morning'
} else if (hour < 17) {
  part_of_the_day = 'afternoon'
} else if (hour < 21) {
  part_of_the_day = 'evening'
} else {
  part_of_the_day = 'night'
}
```

is converted to a [switch step](https://cloud.google.com/workflows/docs/reference/syntax/conditions)

```yaml
- switch1:
    switch:
      - condition: ${hour < 12}
        steps:
          - assign1:
              assign:
                - part_of_the_day: morning
      - condition: ${hour < 17}
        steps:
          - assign2:
              assign:
                - part_of_the_day: afternoon
      - condition: ${hour < 21}
        steps:
          - assign3:
              assign:
                - part_of_the_day: evening
      - condition: true
        steps:
          - assign4:
              assign:
                - part_of_the_day: night
```

## Switch statements

Typescript switch statements are converted to chains of conditions. For example, this statement

```typescript
let b
switch (a) {
  case 1:
    b = 'first'
    break

  case 2:
    b = 'second'
    break

  default:
    b = 'other'
}

return b
```

is converted to

```yaml
steps:
  - assign1:
      assign:
        - b: null
  - switch1:
      switch:
        - condition: ${a == 1}
          next: assign2
        - condition: ${a == 2}
          next: assign3
        - condition: true
          next: assign4
  - assign2:
      assign:
        - b: first
  - next1:
      next: return1
  - assign3:
      assign:
        - b: second
  - next2:
      next: return1
  - assign4:
      assign:
        - b: other
  - return1:
      return: ${b}
```

## Loops

The fragment

```typescript
let total = 0
for (const i of [1, 2, 3]) {
  total += i
}
```

is converted to the following [for loop statement](https://cloud.google.com/workflows/docs/reference/syntax/iteration)

```yaml
steps:
  - assign1:
      assign:
        - total: 0
  - for1:
      for:
        value: i
        in:
          - 1
          - 2
          - 3
        steps:
          - assign2:
              assign:
                - total: ${total + i}
```

`while` and `do...while` loops are also supported:

```typescript
const total = 0
let i = 5

while (i > 0) {
  total += i
  i -= 1
}

let k = 5
do {
  total += k
  k -= 1
} while (k > 0)
```

`for...in` loops are not supported.

### Break and continue in loops

Breaking out of a loop:

```typescript
let total = 0
for (const i of [1, 2, 3, 4]) {
  if (total > 5) {
    break
  }

  total += i
}
```

Continuing from the next iteration of a loop:

```javascript
let total = 0
for (i of [1, 2, 3, 4]) {
  if (i % 2 == 0) {
    continue
  }

  total += i
}
```

## Parallel branches

A special intrinsic `parallel` can be used to execute code branches in parallel. The code blocks to be executed in parallel are given as an array of `() => void` functions. For example, the following code

```javascript
parallel([
  () => {
    http.post('https://forum.dreamland.test/register/bean')
  },
  () => {
    http.post('https://forum.dreamland.test/register/elfo')
  },
  () => {
    http.post('https://forum.dreamland.test/register/luci')
  },
])
```

is converted to [parallel steps](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps)

```yaml
- parallel1:
    parallel:
      branches:
        - branch1:
            steps:
              - call1:
                  call: http.post
                  args:
                    url: https://forum.dreamland.test/register/bean
        - branch2:
            steps:
              - call2:
                  call: http.post
                  args:
                    url: https://forum.dreamland.test/register/elfo
        - branch3:
            steps:
              - call3:
                  call: http.post
                  args:
                    url: https://forum.dreamland.test/register/luci
```

The branches can also be subworkflow names:

```javascript
parallel([my_subworkflow1, my_subworkflow2, my_subworklfow3])
```

An optional second parameter is an object that can define shared variables and concurrency limits. See the GCP documentation for more information.

```javascript
let numPosts = 0

parallel(
  [
    () => {
      n = http.get('https://forum.dreamland.test/numPosts/bean')
      numPosts = numPosts + n
    },
    () => {
      n = http.get('https://forum.dreamland.test/numPosts/elfo')
      numPosts = numPosts + n
    },
  ],
  {
    shared: ['numPosts'],
    concurrency_limit: 2,
  },
)
```

## Parallel iteration

The following form of `parallel` can be called to execute iterations in parallel. The only statement in the function body must be a `for` loop.

```typescript
parallel(() => {
  for (const username of ['bean', 'elfo', 'luci']) {
    http.post('https://forum.dreamland.test/register/' + username)
  }
})
```

is converted to [parallel iteration](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps#parallel-iteration):

```yaml
- parallel1:
    parallel:
      for:
        value: username
        in:
          - bean
          - elfo
          - luci
        steps:
          - call1:
              call: http.post
              args:
                url: ${"https://forum.dreamland.test/register/" + username}
```

The shared variables and concurrency limits can be set with the following syntax:

```typescript
let total = 0

parallel(
  () => {
    for (const i of [1, 2, 3, 4]) {
      total += i
    }
  },
  {
    shared: ['total'],
    concurrency_limit: 2,
  },
)
```

## Try/catch/finally statements

The statement

```javascript
try {
  http.get('https://visit.dreamland.test/')
} catch (err) {
  return 'Error!'
}
```

is converted to the following [try/except structure](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors)

```yaml
- try1:
    try:
      steps:
        - call1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
    except:
      as: err
      steps:
        - return1:
            return: Error!
```

The error variable and other variables created inside the catch block are accessible only in that block's scope (similar to [the variable scoping in Workflows](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors#variable-scope)).

Finally block is also supported:

```javascript
try {
  return readFile()
} catch (err) {
  return 'Error!'
} finally {
  closeFile()
}
```

If an exception gets thrown inside a try block, the stack trace in Workflows logs will misleadingly show the exception originating from inside the finally block. This happens because the finally block is implemented by catching and re-throwing the original exception. The original source location of the exception is lost while re-throwing the exception.

⚠️ At the moment, break and continue are not supported in a try or a catch block if there is a related finally block.

## Retrying on errors

It is possible to set a retry policy for a try-catch statement. Because Typescript does not have `retry` keyword, the retry is implemented by a `retry_policy` intrinsic function. It must be called inside a try block. `retry_policy` is ignored elsewhere. Only the first `retry_policy` in a try block has any effect.

The arguments of `retry_policy` specify which errors are retried and how many times. The arguments can be either a policy provided by GCP Workflows or a custom retry policy as explained in the next sections.

If an exception gets thrown in a try block and the retry policy covers the exception, the try block is executed again. Finally and catch blocks are run if the try block keeps failing after all retry attempts have been used up. The following sample retries `http.get()` if it throws an HTTP error covered by `http.default_retry`. It logs `sys.log('Error!')` if the number of retry attempts exceed retry policy's maximum retry attempt count. `closeConnection()` is run always regardless of whether the HTTP request succeeded or failed.

```javascript
import { http, retry_policy, sys } from 'ts2workflows/types/workflowslib'

function main() {
  try {
    retry_policy(http.default_retry)

    http.get('https://visit.dreamland.test/')
  } catch (err) {
    sys.log('Error!')
  } finally {
    closeConnection()
  }
}
```

### GCP-provided retry policy

GCP provides some retry policies. A GCP policy can be set by `retry_policy(http.default_retry)` or by `retry_policy(http.default_retry_non_idempotent)`. Their effects are described in the [GCP documentation](https://cloud.google.com/workflows/docs/reference/syntax/retrying#default-retry-policy).

```javascript
import { http, retry_policy } from 'ts2workflows/types/workflowslib'

function main() {
  try {
    retry_policy(http.default_retry)

    http.get('https://visit.dreamland.test/')
  } catch (err) {
    return 'Error!'
  }
}
```

### Custom retry policy

A custom retry policy is an object with the properties shown in the following example. See the GCP documentation for the [explanation of the properties](https://cloud.google.com/workflows/docs/reference/syntax/retrying#try-retry).

The parameter must be a literal map object (not a variable). The values may be literals or expressions.

```javascript
import { http, retry_policy } from 'ts2workflows/types/workflowslib'

function main() {
  try {
    retry_policy({
      predicate: http.default_retry_predicate,
      max_retries: 3,
      backoff: {
        initial_delay: 0.5,
        max_delay: 60,
        multiplier: 2,
      },
    })

    http.get('https://visit.dreamland.test/')
  } catch (err) {
    return 'Error!'
  }
}
```

ts2workflows converts the above to the following [try step](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors)

```yaml
main:
  steps:
    - try1:
        try:
          steps:
            - call1:
                call: http.get
                args:
                  url: https://visit.dreamland.test/
        retry:
          predicate: ${http.default_retry_predicate}
          max_retries: 3
          backoff:
            initial_delay: 0.5
            max_delay: 60
            multiplier: 2
        except:
          as: err
          steps:
            - return1:
                return: Error!
```

## Throwing errors

The statement

```javascript
throw 'Error!'
```

is converted to the following [raise block](https://cloud.google.com/workflows/docs/reference/syntax/raising-errors)

```yaml
- raise1:
    raise: 'Error!'
```

The error can be a string, a map or an expression that evaluates to string or map.

Thrown errors can be handled by a try statement.

## Labeled steps

ts2workflows labels output steps with the step type and sequential numbering by default: e.g. `assign1`, `assign2`, etc. The automatic labels can be overridden by using Typescript labeled statements.

```typescript
setName: const name = 'Bean'
```

is converted to a step with the label `setName`:

```yaml
- setName:
    assign:
      - name: Bean
```

## Type annotations for standard library functions

Type annotations for [GCP Workflows standard library functions and expression helpers](https://cloud.google.com/workflows/docs/reference/stdlib/overview) are provided by importing "ts2workflows/types/workflowslib".

```typescript
import { sys } from 'ts2workflows/types/workflowslib'

function read_from_env() {
  return sys.get_env('GOOGLE_CLOUD_PROJECT_ID')
}
```

At the moment, type annotations are provided for some [connectors](https://cloud.google.com/workflows/docs/reference/googleapis) but not for all of them.

### Runtime functions

This section describes the few standard Javascript runtime functions that are available. Most are not.

### Array.isArray()

```typescript
Array.isArray(arg: any): arg is any[]
```

Gets converted to the comparison `get_type(arg) == "list"`. Unlike a direct call to `get_type()`, `Array.isArray()` acts a type guard and allows narrowing the `arg` type to an array.

## Compiler intrinsics

ts2workflows has some special intrinsic functions that are implemented directly by the ts2workflows transpiler instead of converting to Workflows code using the usual semantics. These are needed for implementing features that are not directly supported by Typescript language features. The type annotations for these functions can be imported from ts2workflows/types/workflowslib:

```typescript
import {
  call_step,
  parallel,
  retry_policy,
} from 'ts2workflows/types/workflowslib'
```

The compiler intrinsics are documented below.

### call_step()

```typescript
function call_step<T, A extends any[]>(
  func: (...args: A) => T,
  arguments: Record<string, unknown>,
): T
```

The `call_step` function outputs a [call step](https://cloud.google.com/workflows/docs/reference/syntax/calls).

### parallel()

```typescript
function parallel(
  branches: (() => void)[] | (() => void),
  options?: {
    shared?: string[]
    concurrency_limit?: number
    exception_policy?: string
  },
): void
```

The `parallel` function executes code blocks in parallel using a [parallel step](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps). See the previous sections covering parallel branches and iteration.

### retry_policy()

```typescript
function retry_policy(
  params:
    | ((errormap: Record<string, any>) => void)
    | {
        predicate: (errormap: Record<string, any>) => boolean
        max_retries: number
        backoff: {
          initial_delay: number
          max_delay: number
          multiplier: number
        }
      },
): void
```

A retry policy can be attached to a `try`-`catch` block by calling `retry_policy` inside the `try` block. ts2workflows ignores `retry_policy` everywhere else.

See the section on [retrying errors](#retrying-on-errors).

## Source code comments

In-line comments start with `//`. The rest of the line starting from `//` is considered a comment. Multiline comments are defined with the `/* */` syntax.

Example:

```typescript
const var1 = 1 // This is a comment
```

## Unsupported Typescript features

ts2workflows supports only a subset of all Typescript language features. Some examples that are not (yet) supported by ts2workflows:

- Most functions provided by a Javascript runtime (`console.log()`, `setInterval()`, etc) are not available. Only the [GCP Workflows standard library functions](https://cloud.google.com/workflows/docs/reference/stdlib/overview) and [connectors](https://cloud.google.com/workflows/docs/reference/googleapis) are available.
- Classes (`class`) are not supported
- Arrays and maps are not objects. In particular, arrays don't have methods such as `[].push()`, `[].map()`, etc.
- Functions (subworkflows) are not first-class objects. Functions can not be assigned to a variable or passed to other functions
- Update expressions (`x++` and similar) are not supported
- and many other Typescript language features are not supported

Some of these might be implemented later, but the goal of ts2workflows project is not to implement the full Typescript compatibility.
