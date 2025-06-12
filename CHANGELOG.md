# ts2workflows changelog

## unreleased

Breaking changes:

- retry_policy() must be called inside a try block
- variable declarations with `var` are not supported, only `let` and `const`
- Requires Node 20 or newer

Fixes:

- Type annotation fixes

## Version 0.10.0 - 2025-04-28

- Accept binary expressions as properties in assignments: `a[i + 4] = 1` (regression in 0.9.0)
- Evaluate side-effects only once on the left-hand side in compound assignments: `x[f()] += 1`
- Fix calling `call_step()` on the right-hand side of a compound assignment: `x += call_step(sum, {a: 10, b: 11})`
- Output an error is a subworkflow is empty because empty body is not allowed on GCP

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
