# Language reference

ts2workflow converts Typescript source code to GCP Workflows YAML syntax. Only a subset of Typescript language features are supported. This page documents supported Typescript features and shows examples of the generted Workflows YAML output.

Functions provided by a Javascript runtime (`console.log`, `setInterval`, etc) are not available.

Type annotations are allowed. Type checking is done by the compiler but the types dont't affect the generated Workflows code.

Semicolon can be used as optional statement delimitter.

## Data types

- Integer (64 bit, signed)
- Double (64 bit, signed floating point number)
- String: `"my beautiful string"`, both single or double quotes are accepted
- Boolean: `true`/`false`
- Bytes
- `null`. In addition to the literal `null`, the Typescript `undefined` value is also converted to `null`.
- Array: `[1, 2, 3]`. Array are not objects. In particular, methods like `array.map()` and `array.concat()` are not available.
- Map: `{temperature: -12, unit: "Celsius"}`. Key can also be strings: `{"temperature": -12, "unit": "Celsius"}`. Trailing commas are allowed.

## Template literals

Template literals are strings that support string interpolation. For example, `Hello ${name}`.

Interpolated values can be numbers, strings, booleans or nulls. Other types will throw a TypeError during execution.

## Expressions

Examples:

```javascript
a + b

args.users[3].id

name === 'Bean'

sys.get_env('GOOGLE_CLOUD_PROJECT_ID')
```

Operators:

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

The [precendence order of operators](https://cloud.google.com/workflows/docs/reference/syntax/datatypes#order-operations) is the same as in GCP Workflows.

See [expression in GCP Workflows](https://cloud.google.com/workflows/docs/reference/syntax/expressions) for more information.

## Subworkflow definitions

Typescript `function`s are converted to subworkflow definitions.

The program code must be written inside workflow blocks. Only `function` and `import` declarations are allowed on the top level of a source code file.

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

## Function and subworkflow calls

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

This syntax can be used to call [standard library functions](https://cloud.google.com/workflows/docs/reference/stdlib/overview) or subworkflows.

The transpiler automatically detects [blocking calls](https://cloud.google.com/workflows/docs/reference/syntax/expressions#blocking-calls) and converts them to call steps (instead of assign steps) as required by the GCP Workflows runtime.

Some Workflows standard library functions have names that are reserved keywords in Typescript. Those functions must be called with alternative names in ts2workflows source code:

To generate a call to `default()` in Workflows code, use the nullish coalescing operator `??`.
To generete a call to `if()` in Workflows code, use the ternary operator `a ? b : c`.

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

## Conditional (ternary) operator

The expression

```javascript
x > 0 ? 'positive' : 'not positive'
```

is converted to an [if() expression](https://cloud.google.com/workflows/docs/reference/stdlib/expression-helpers#conditional_functions):

```yaml
${if(x > 0, "positive", "not positive")}
```

Note that Workflows always evaluates both expression branches unlike Typescript which evaluates only the branch that gets executed.

## Nullish coalescing operator

The expression

```javascript
x ?? 'default value'
```

is converted to an [default() expression](https://cloud.google.com/workflows/docs/reference/stdlib/expression-helpers#conditional_functions):

```yaml
${default(x, "default value")}
```

Note that Workflows always evaluates the right-hand side expression unlike Typescript which evaluates the right-hand side only if the left-hand side is `null` or `undefined`.

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

## Try/catch statements

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

## Retrying on errors

It is possible to set a retry policy for a try-catch statement. Because Typescript does not have `retry` keyword, the retry is implemented by a special `retry_policy` function. It must be called immediately after a try-catch block. A call to the `retry_policy` is ignored elsewhere.

The `retry_policy` function must be called with parameters defining a retry policy. It can be either a policy provided by GCP Workflows or a custom retry policy. See the GCP documentation for the [required parameters for the two policy types](https://cloud.google.com/workflows/docs/reference/syntax/retrying#try-retry).

A sample with a GCP-provided retry policy:

```javascript
import { http, retry_policy } from 'ts2workflows/types/workflowslib'

function main() {
  try {
    http.get('https://visit.dreamland.test/')
  } catch (err) {
    return 'Error!'
  }
  retry_policy({ policy: http.default_retry })
}
```

A sample with a custom retry policy:

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

## Importing type annotations

Type annotations for GCP Workflows standard library functions and expression helpers are provided by importing "ts2workflows/types/workflowslib".

```typescript
import { http } from 'ts2workflows/types/workflowslib'

function read_data_from_web() {
  return http.get('https://visit.dreamland.test/')
}
```

At the moment, type annotations are provided for some [connectors](https://cloud.google.com/workflows/docs/reference/googleapis) but not for all of them.

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

## Special run-time functions

ts2workflows provides some special functions for implementing features that are not directly supported by Typescript language features.

- `parallel` function for executing code blocks in parallel. See the previous sections covering parallel branches and iteration.
- `retry_policy` function that can be combined with `try`-`catch` block to specify a retry policy.

It is not possible to call subworkflows with these names, because the transpiler treats these names as special cases.

See [type annotations](types/workflowslib.d.ts) for these functions.

## Source code comments

In-line comments start with `//`. The rest of the line starting from `//` is considered a comment. Multiline comments are defined with the `/* */` syntax.

Example:

```typescript
const var1 = 1 // This is a comment
```

## Unsupported Typescript features

ts2workflows supports only a subset of all Typescript language features. Some examples that are not (yet) supported by ts2workflows:

- Functions provided by a Javascript runtime (`console.log`, `setInterval`, etc) are not available. Only the [GCP Workflows standard library functions](https://cloud.google.com/workflows/docs/reference/stdlib/overview) are available.
- Classes (`class`) are not supported
- Arrays and maps are not objects. In particular, arrays don't have methods such as `array.push()`, `array.map()`, etc.
- Functions (subworkflows) are not first-class objects. Functions can not be assigned to a variable or passed to other functions
- Update expressions (`x++` and similar) are not supported
- Destructuring (`[a, b] = func()`) is not supported
- and many other Typescript language features are not supported

Some of these might be implemented later, but the goal of ts2workflows project is not to implement the full Typescript compatibility.
