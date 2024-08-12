# Typescript to GCP Workflows transpiler

Status: This project is under development. Not ready for production use yet!

ts2workflows converts Typescript code to a [GCP Workflows](https://cloud.google.com/workflows/docs/apis) program.

Only a subset of Typescript features are supported. The [language reference](language_reference.md) shows the supported Typescript features.

See the [samples](samples) directory for code examples.

## Command for transpiling a Typescript file to Workflows syntax

Converting Typescript code in a file samples/sample1.ts into GCP Workflows syntax:

```sh
npx ts2workflows samples/sample1.ts
```

When developing ts2workflows, you can run the transpiler directly from the source directory:

```sh
npx tsx src/cli.ts samples/sample1.ts
```

## Type checking

One benefit of writing the workflow programs in Typescript is that the sources can be type checked.

This example command shows how to type check source files in the [samples](samples) directory. The command will print typing errors or finish quietly, if there are no errors.

```sh
npx tsc --project samples/tsconfig.workflows.json
```

The file [samples/tsconfig.workflows.json](samples/tsconfig.workflows.json) contains a sample configuration for type checking workflow sources.

Type annotations for [Workflows standard library functions and expression helpers](https://cloud.google.com/workflows/docs/reference/stdlib/overview) and for some [connectors](https://cloud.google.com/workflows/docs/reference/googleapis) are provided in [types/workflowslib.d.ts](types/workflowslib.d.ts). They are also included in the npm module. To import type annotations in a project that has ts2workflows module as a dependency, do the following:

```javascript
import { http, retry_policy } from 'ts2workflows/types/workflowslib'
```

## Build

```
npm install
npm run build
```

## Run unit tests

```
npm run test
```

## License

[The MIT License](LICENSE)
