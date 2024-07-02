# Language reference

ts2workflow converts Typescript source code to GCP Workflows YAML syntax. Only a subset of Typescript language features are supported. This page documents supported Typescript features and shows examples of the generted Workflows YAML output.

Functions provided by a Javascript runtime (`console.log`, `setInterval`, etc) are not available.

Type annotations are allowed. Type checking is done by the compiler but the types dont't affect the generated Workflows code.

Semicolon can be used as optional statement delimitter.

## Data types

- Integer (64 bit, signed)
- Double (64 bit, signed floating point number)
- String: `"my beautiful string"`
- Boolean: `true`/`false`
- `null`. In addition to the literal `null`, the Typescript `undefined` value is also converted to `null`.
- Array: `[1, 2, 3]`. Array are not objects. In particular, methods like `map()` and `concat()` are not available.
- Map: `{"temperature": -12, "unit": "Celsius"}`

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
  return 'Compute logarithm of x'
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

will be converted to an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step):

```yaml
- assign1:
    assign:
      - name: Bean
```

Compound assignments are also supported:

```typescript
total += 1
```

will be converted to

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

will be converted to an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step):

```yaml
- assign1:
    assign:
      - projectId: ${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
```

This syntax can be used to call [standard library functions](https://cloud.google.com/workflows/docs/reference/stdlib/overview) or subworkflows.

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

will be converted to a [switch step](https://cloud.google.com/workflows/docs/reference/syntax/conditions)

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

## Loops

The fragment

```typescript
let total = 0
for (const i of [1, 2, 3]) {
  total += i
}
```

will be converted to the following [for loop statement](https://cloud.google.com/workflows/docs/reference/syntax/iteration)

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

Only `for...of` loops are supported for now. Other types of looping constructs (`do`, `while`) might be added later.

### Break and continue in a for loop

Breaking out of loop:

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
    post_http('https://forum.dreamland.test/register/bean')
  },
  () => {
    post_http('https://forum.dreamland.test/register/elfo')
  },
  () => {
    post_http('https://forum.dreamland.test/register/luci')
  },
])
```

will be converted to [parallel steps](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps)

```yaml
parallel1:
  parallel:
    branches:
      - branch1:
          steps:
            - assign1:
                assign:
                  - '': ${post_http("https://forum.dreamland.test/register/bean")}
      - branch2:
          steps:
            - assign2:
                assign:
                  - '': ${post_http("https://forum.dreamland.test/register/elfo")}
      - branch3:
          steps:
            - assign3:
                assign:
                  - '': ${post_http("https://forum.dreamland.test/register/luci")}
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
      n = get_http('https://forum.dreamland.test/numPosts/bean')
      numPosts = numPosts + n
    },
    () => {
      n = get_http('https://forum.dreamland.test/numPosts/elfo')
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
    post_http('https://forum.dreamland.test/register/' + username)
  }
})
```

will be converted to [parallel iteration](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps#parallel-iteration):

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
          - assign1:
              assign:
                - '': ${post_http("https://forum.dreamland.test/register/" + username)}
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
  get_http('https://visit.dreamland.test/')
} catch (err) {
  return 'Error!'
}
```

will be compiled to the following [try/except structure](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors)

```yaml
try1:
  try:
    steps:
      - assign1:
          assign:
            - '': ${get_http("https://visit.dreamland.test/")}
  except:
    as: err
    steps:
      - return1:
          return: Error!
```

The error variable and other variables created inside the catch block are accessible only in that block's scope (similar to [the variable scoping in Workflows](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors#variable-scope)).

## Throwing errors

The statement

```javascript
throw 'Error!'
```

will be compiled to the following [raise block](https://cloud.google.com/workflows/docs/reference/syntax/raising-errors)

```yaml
raise1:
  raise: 'Error!'
```

The error can be a string, a map or an expression that evaluates to string or map.

Thrown errors can be handled by a try statement.

## Run-time functions

ts2workflows provides some special functions for implementing features that are not directly supported by Typescript constructs.

- `parallel` function for executing code blocks in parallel. See the previous sections covering parallel branches and iteration. `function parallel(branches: (() => void)[] | (() => void), options: { shared?: string[], concurrency_limit?: number, exception_policy?: string } = {}): void`

## Source code comments

In-line comments start with `//`. The rest of the line starting from `//` is considered a comment. Multiline comments are defined with the `/* */` syntax.

Example:

```typescript
const var1 = 1 // This is a comment
```
