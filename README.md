# Typescript to GCP Workflows transpiler

ts2workflows converts Typescript code to a [GCP Workflows](https://cloud.google.com/workflows/docs/apis) program.

![NPM Version](https://img.shields.io/npm/v/ts2workflows)
![Node LTS](https://img.shields.io/node/v-lts/ts2workflows)

Only a subset of Typescript features are supported. The [language reference](language_reference.md) describes the supported Typescript features.

See the [samples](samples) directory for code examples.

Project status: It's possible to write Workflows programs, but the transpiler has not been extensively tested. Expect some rough edges!

## Installation

```
npm install ts2workflows
```

## Usage

Converting Typescript code in a file samples/sample1.ts into GCP Workflows YAML syntax on stdout:

```sh
npx ts2workflows samples/sample1.ts
```

Compile multiple files and write result to an output directory `workflowsfiles`. This will write one output file corresponding to each input file in a directory given by the `--outdir` argument. The output files are named similarly to the input files but using `.yaml` as the file extension. The output directory will be created if it doesn't exist. Supplying the TSConfig with the `--project` argument makes compiling multiple files faster.

```sh
npx ts2workflows --project samples/tsconfig.json --outdir workflowsfiles samples/*.ts
```

When developing ts2workflows, you can run the transpiler directly from the source directory:

```sh
npx tsx src/cli.ts samples/sample1.ts
```

## Type checking workflow sources

One benefit of writing the workflow programs in Typescript is that the sources can be type checked.

This example command shows how to type check source files in the [samples](samples) directory using the standard Typescript compiler `tsc`. The command prints typing errors or finishes silently, if there are no errors.

```sh
npx tsc --project samples/tsconfig.json
```

The file [samples/tsconfig.json](samples/tsconfig.json) contains a sample configuration for type checking workflow sources.

Type annotations for [Workflows standard library functions and expression helpers](https://cloud.google.com/workflows/docs/reference/stdlib/overview) and for some [connectors](https://cloud.google.com/workflows/docs/reference/googleapis) are provided in [types/workflowslib.d.ts](types/workflowslib.d.ts). They are also included in the published npm module. To import type annotations in a project that has ts2workflows module as a dependency, use the following import command:

```javascript
import { http, retry_policy } from 'ts2workflows/types/workflowslib'
```

Type checking step is completely separate from the transpiling. The ts2workflows command ignores type annotations.

## Development

### Build

```
npm install
npm run build
```

### Run unit tests

```
npm run test
```

Run tests and print the test coverage:

```
npm run test-coverage
```

### Architecture

A transpilation using ts2workflows consists of five phases:

- parsing Typescript source code
- converting to intermediate representation (IR)
- transforming and optimizing the IR
- assigning names for the Workflows steps
- outputting in the program in Workflows YAML format

The main function implementing these phases is `transpile()` in [src/transpiler/index.ts](src/transpiler/index.ts).

The transpiler parses a Typescript source file using [@typescript-eslint/typescript-estree](https://www.npmjs.com/package/@typescript-eslint/typescript-estree) module by the [typescript-eslint](https://typescript-eslint.io/) project. The result of the parsing is an [ESTree](https://github.com/estree/estree/blob/master/README.md)-compatible abstract syntax tree (AST) of the source code. [typescript-eslint playgroud](https://typescript-eslint.io/play/) is an useful tool for exploring the Typescript parsing.

Next, ts2workflows converts the AST to a custom intermediate representation (IR). The IR format brings the representation of the program closer the GCP Workflows language than Typescript code. The types for IR are defined in the [src/ast](src/ast) directory. Particularly, see [src/ast/steps.ts](src/ast/steps.ts) for Workflow step types and [src/ast/expressions.ts](src/ast/expressions.ts) for expression types.

The transpiler applies a few transformations to the IR to make it a valid and optimized Workflows program. These transformations, for example, merge consecutive assignments into a single assign step and ensure that blocking function are invoked by call steps (as required by Workflows). The transformations are implemented in [src/transpiler/transformations.ts](src/transpiler/transformations.ts).

To spare the programmer from labeling each and every Workflows step manually, ts2workflows automatically assigns names to the steps. The automatically choosen step names consist of the step type and a sequential number. The implementation is in [src/ast/stepnames.ts](src/ast/stepnames.ts).

Finally, the transpiler converts the result into a YAML document.

## License

[The MIT License](LICENSE)
