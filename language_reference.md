# Language reference

ts2workflow converts Typescript source code to GCP Workflows YAML syntax. Only a subset of Typescript language features are supported. This page documents supported Typescript features and shows examples of the generted Workflows YAML output.

Most functions provided by a Javascript runtime (`console.log()`, `setInterval()`, etc) are not available.

Type annotations are allowed. Type checking is done by the compiler but the types dont't affect the generated Workflows code.

Semicolon can be used as optional statement delimitter.

⚠️ Semantics of certain operations are different from Typescript semantics. These differences are highlighted with the warning icon ⚠️ on this documentation.

## Data types

- `number`: Integer (64 bit, signed) or double (64 bit, signed floating point number)
- `string`: `"my beautiful string"`, both single or double quotes are accepted
- `boolean`: `true`/`false`
- `bytes`
- `null`
- Array: `[1, 2, 3]`
- Map: `{temperature: -12, unit: "Celsius"}`

### Array type

⚠️ Arrays are not objects. In particular, methods like `[].map()` and `[].concat()` are not available.

⚠️ Accessing out-of-bounds index will cause an IndexError at runtime unlike in Typescript where out-of-bounds access would return `undefined`.

### Map type

Map keys can be identifiers or strings: `{temperature: -12}` or `{"temperature": -12}`. Trailing commas are allowed.

⚠️ Trying to access a non-existing member of an object will throw a KeyError at runtime, unlike in Typescript where it would return `undefined`.

### Bytes type

It is not possible to construct a bytes object expect by calling a function that returns bytes (e.g. base64.decode). It is not possible to do anything else with a bytes object than to assign it to a variable and to pass it one of the functions that take bytes type as input variable (e.g. base64.encode).

### null type

In addition to the literal `null`, the Typescript `undefined` value is also treated as `null` in Workflows YAML.

### Implicit type conversions

Expressions that combine variables with operators such as `+`, `>`, `==` perform implict type conversions according to the [rules listed on GCP Workflows documentation](https://cloud.google.com/workflows/docs/reference/syntax/datatypes#implicit-conversions). For example, applying `+` to a string and a number concatenates the values into a string.

⚠️ Checking if a variable is null or not must be done by an explicit comparison: `if (var != null) {...}`. Relying in an implicit conversion, such as `if (var) {...}`, results in a TypeError at runtime.

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

| Operator     | Description                                  |
| ------------ | -------------------------------------------- |
| +            | arithmetic addition and string concatenation |
| -            | arithmetic subtraction or unary negation     |
| \*           | multiplication                               |
| /            | float division                               |
| %            | remainder division                           |
| ==, ===      | equal to (both mean strict equality)         |
| !=, !==      | not equal to (both mean strict equality)     |
| <, >, <=, >= | inequality comparisons                       |
| &&, \|\|, !  | logical operators                            |
| in           | check if a property is present in an object  |
| ??           | nullish coalescing                           |
| ?.           | optional chaining                            |
| ? :          | conditional operator                         |
| typeof       | return the type of the operand as a string   |

The [precendence order of operators](https://cloud.google.com/workflows/docs/reference/syntax/datatypes#order-operations) is the same as in GCP Workflows.

See [expression in GCP Workflows](https://cloud.google.com/workflows/docs/reference/syntax/expressions) for more information.

### Conditional (ternary) operator

The expression

```javascript
x > 0 ? 'positive' : 'not positive'
```

is converted to an [if() expression](https://cloud.google.com/workflows/docs/reference/stdlib/expression-helpers#conditional_functions):

```yaml
${if(x > 0, "positive", "not positive")}
```

⚠️ Note that Workflows always evaluates both expression branches unlike Typescript which evaluates only the branch that gets executed.

### Nullish coalescing operator

The expression

```javascript
x ?? 'default value'
```

is converted to a [default() expression](https://cloud.google.com/workflows/docs/reference/stdlib/expression-helpers#conditional_functions):

```yaml
${default(x, "default value")}
```

⚠️ Note that Workflows always evaluates the right-hand side expression unlike Typescript which evaluates the right-hand side only if the left-hand side is `null` or `undefined`.

### Optional chaining

The optional chaining expression

```javascript
data.user?.name
```

is converted to a [map.get() expression](https://cloud.google.com/workflows/docs/reference/stdlib/map/get):

```yaml
${map.get(data, ["user", "name"])}
```

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

Template literals are strings that support string interpolation. For example, `Hello ${name}`.

⚠️ Interpolated values can (only) be numbers, strings or booleans. Other types will throw a TypeError at runtime.

## Subworkflow definitions

Typescript `function`s are converted to subworkflow definitions.

The program code must be written inside workflow blocks. Only `function` and `import` declarations are allowed on the top level of a source code file. Functions can only be defined at the top level of a source file, not inside functions or in other nested scopes.

The workflow execution starts from the subworkflow called "main".

```typescript
function main(): void {
  const a = 1
}

function anotherWorkflow(): number {
  const b = 10
  return 2 * b
}
```

Workflows can have parameters:

```typescript
function multiply(firstFactor: number, secondFactor: number): number {
  return firstFactor * secondFactor
}
```

Parameters can be optional and have a default value that is used if a value is not provided in a subworkflow call:

```typescript
function log(x, base = 10) {
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

The statement

```typescript
const projectId = sys.get_env('GOOGLE_CLOUD_PROJECT_ID')
```

is converted to an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step):

```yaml
- assign1:
    assign:
      - projectId: ${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
```

This syntax can be used to call [standard library functions](https://cloud.google.com/workflows/docs/reference/stdlib/overview), subworkflows or connectors. Note that Javascript runtime functions (such as `fetch()`, `console.error()` or `new XMLHttpRequest()`) are not available on Workflows.

GCP Workflows language has two ways of calling functions and subworkflows: as expression in an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step) or as [call step](https://cloud.google.com/workflows/docs/reference/syntax/calls). They can mostly be used interchangeably. However, [blocking calls](https://cloud.google.com/workflows/docs/reference/syntax/expressions#blocking-calls) must be made as call steps. The transpiler tries to automatically output a call step when necessary.

It is also possible to force a function to be called as call step. This might be useful, if the transpiler fails to output call step when it should, or if you want to use named parameters. For example, the following Typescript program

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

Typescript switch statements are transpiled to chains of conditions. For example, this statement

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

The special function `parallel` can be used to execute several code branches in parallel. The code blocks to be executed in parallel are given as an array of `() => void` functions. For example, the following code

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

An optional second parameter is an object that can define shared variables and concurrency limits:

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

is compiled to the following [try/except structure](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors)

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

If an exception gets thrown inside a try block, the stack trace in Workflows logs will misleadingly show the exception originating from inside the finally block. This happens because the implementation of the finally block catches the original exception and later throws an identical exception. The original source location of the exception is lost.

⚠️ At the moment, break and continue are not supported in a try or a catch block if there is a related finally block.

## Retrying on errors

It is possible to set a retry policy for a try-catch statement. Because Typescript does not have `retry` keyword, the retry is implemented by a special `retry_policy` function. It must be called immediately after a try-catch block. A call to the `retry_policy` is ignored elsewhere.

Finally and catch blocks are run after possible retry attempts. The following sample retries `http.get()` if it throws an exception and executes `sys.log('Error!')` and `closeConnection()` after retry attempts.

```javascript
import { http, retry_policy, sys } from 'ts2workflows/types/workflowslib'

function main() {
  try {
    http.get('https://visit.dreamland.test/')
  } catch (err) {
    sys.log('Error!')
  } finally {
    closeConnection()
  }
  retry_policy(http.default_retry)
}
```

The `retry_policy` function must be called with a parameter that defines the retry policy. It can be either a policy provided by GCP Workflows or a custom retry policy.

### GCP-provided retry policy

GCP retry policy must be either `http.default_retry` or `http.default_retry_non_idempotent`. Their effects are described by the [GCP documentation](https://cloud.google.com/workflows/docs/reference/syntax/retrying#default-retry-policy).

```javascript
import { http, retry_policy } from 'ts2workflows/types/workflowslib'

function main() {
  try {
    http.get('https://visit.dreamland.test/')
  } catch (err) {
    return 'Error!'
  }
  retry_policy(http.default_retry)
}
```

### Custom retry policy

A custom retry policy is an object with the properties shown in the following example. See the GCP documentation for the [explanation of the properties](https://cloud.google.com/workflows/docs/reference/syntax/retrying#try-retry).

The parameter must be a literal map object (not a variable). The values may be literals or expressions.

```javascript
import { http, retry_policy } from 'ts2workflows/types/workflowslib'

function main() {
  try {
    http.get('https://visit.dreamland.test/')
  } catch (err) {
    return 'Error!'
  }
  retry_policy({
    predicate: http.default_retry_predicate,
    max_retries: 3,
    backoff: {
      initial_delay: 0.5,
      max_delay: 60,
      multiplier: 2,
    },
  })
}
```

The above is compiled to the following [try/except structure](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors)

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

is compiled to the following [raise block](https://cloud.google.com/workflows/docs/reference/syntax/raising-errors)

```yaml
- raise1:
    raise: 'Error!'
```

The error can be a string, a map or an expression that evaluates to string or map.

Thrown errors can be handled by a try statement.

## Labeled steps

The transpiler labels output steps with the step type and sequential numbering by default: e.g. `assign1`, `assign2`, etc. The automatic labels can be overridden by using Typescript labeled statements.

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

Type annotations for GCP Workflows standard library functions and expression helpers are provided by importing "ts2workflows/types/workflowslib".

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

Gets converted to the comparison `get_type(arg) == "list"`. Unlike a direct call to `get_type()`, `Array.isArray()` allows the type inference to learn if `arg` is array or not.

## Language extension functions

ts2workflows provides some special functions for implementing features that are not directly supported by Typescript language features. The type annotations for these functions can be imported from ts2workflows/types/workflowslib:

```typescript
import {
  call_step,
  parallel,
  retry_policy,
} from 'ts2workflows/types/workflowslib'
```

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

The `parallel` function executes code blocks in parallel (using [parallel step](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps)). See the previous sections covering parallel branches and iteration.

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

The `retry_policy` function can called right after a `try`-`catch` block to specify a retry policy. See the section on [retrying errors](#retrying-on-errors).

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
- Destructuring (`[a, b] = func()`) is not supported
- and many other Typescript language features are not supported

Some of these might be implemented later, but the goal of ts2workflows project is not to implement the full Typescript compatibility.
