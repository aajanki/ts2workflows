# ts2workflows changelog

## Version 0.12.0 - 2025-08-30

New features:

- New command line option `--link` generates self-contained YAML files (all needed subworkflows in one file)
- Accepts Typescript's `satisfies` expression and `debugger` statement. They do not affect the YAML output.

Fixes:

- Empty body in an `if` statements generated invalid code
- In certain cases nested map literals generated invalid code
- Some expressions with many extractable sub-expressions (map literals, blocking calls) generated invalid code because a temporary variable was re-used incorrectly
- Empty statements are accepted at the top level
- Ignore extra arguments in blocking function calls in all cases. Previously, extra arguments were ignored in some cases but threw errors in other cases.
- Call expressions in optional chaining (`data?.getPerson()?.name`) now result in error. Previously, they were incorrectly treated as non-optional in the generated code.
- Fixed code generation for an object rest element nested in an array pattern: `const [{...rest}] = data`

## Version 0.11.0 - 2025-06-28

Breaking changes:

- Requires Node 20 or newer and Typescript 5.4.0 or newer
- retry_policy() must be called inside a try block, not after
- Variable declarations with `var` are not supported, only `let` and `const`
- Step name numbering starts from 1 at the start of each subworkflow

Fixes:

- Type annotation fixes in workflowslib

## Version 0.10.0 - 2025-04-28

- Accept binary expressions as properties in assignments: `a[i + 4] = 1` (regression in 0.9.0)
- Evaluate side-effects only once on the left-hand side in compound assignments: `x[f()] += 1`
- Fix calling `call_step()` on the right-hand side of a compound assignment: `x += call_step(sum, {a: 10, b: 11})`
- Output an error if a subworkflow is empty because empty body is not allowed on GCP

## Version 0.9.0 - 2025-04-23

Breaking changes:

- `True`, `TRUE`, `False` and `FALSE` no longer are synonyms for `true` and `false`

New features:

- Array and object destructuring: `const [a, b] = getArray()`

Fixes:

- Fix a deployment error caused by the same temp variable name being used inside and outside of a parallel branch

## Version 0.8.0 - 2025-03-03

- Multiple input files can be given on the command line
- Argument `--outdir` sets the output directory
- Argument `--project` defines the TSConfig location for the source files
- `--(no-)generated-file-comment`: optionally include a comment about the output file being generated
- `--version` prints the correct version number
- Accept instantiation expressions `func<TYPE>`

## Version 0.7.0 - 2025-02-02

- `typeof` operator
- `null` is allowed as interpolated value in template literal `${null}`
- Accept `undefined` as a function argument default argument: `func(a: number | undefined = undefined)`
- Optional function arguments: `func(a?: number)`

## Version 0.6.0 - 2025-01-09

Breaking changes:

- retry_policy() takes a plain policy function name instead of a {policy: ...} object

Fixes:

- The try statement supports a finally block
- Support empty body in a catch block
- retry_policy() parameter values can now be expressions in addition to number literals
- 0, "", false and null can now be used as subworkflow parameter default values
- Type annotation fixes

## Version 0.5.0 - 2024-11-09

- Move nested map expressions to assign steps where necessary
- Array.isArray() is transformed correcly in nested expressions

## Version 0.4.0 - 2024-11-05

- Optional chaining a?.b is converted to map.get(a, "b")
- Non-null assertions person!.name is accepted but ignored to the transpiler
- Merge a next step to a preceeding assign step
- Accept a single-statement body (body without braces {}) in if, while, etc
- Assign the result of call_step() to a member variable: obj.property = call_step()
- parallel() and retry_policy() special functions can only be used as statements
- Better error messages on RegExp, BigInt, spread syntax and other non-supported Javascript features

## Version 0.3.0 - 2024-10-19

- Function invocations no longer generate invalid empty variable names
- Include more utility types: ReturnType, Partial, Required, etc.
- Type annotation fixes

## Version 0.2.0 - 2024-10-09

- Reduce cases where maps are needlessly split off into assign statements
- Accept (but ignore) "declare function"
- Implemented Array.isArray()
- Fixes to type annotations
