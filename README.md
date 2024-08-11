# Typescript to GCP Workflows transpiler

Status: This project is under development. Not ready for production use yet!

ts2workflows converts Typescript code to a [GCP Workflows](https://cloud.google.com/workflows/docs/apis) program.

Only a subset of Typescript features are supported. The [language reference](language_reference.md) shows the supported Typescript features.

See the [samples](samples) directory for code examples.

## Command for transpiling a Typescript file to Workflows syntax

Converting Typescript code in a file samples/sample1.ts into GCP Workflows syntax:

```
npx ts2workflows samples/sample1.ts
```

When developing ts2workflows, you can run the tranpiler directly from the source directory:

```
npx tsx src/cli.ts samples/sample1.ts
```

## Type checking

One benefit of writing the workflow programs in Typescript is that the sources can be type checked.

This example command shows how to type check source files in the [samples](samples) directory. The command will print typing errors or finish quietly, if there are no errors.

```
npx tsc --project samples/tsconfig.workflows.json
```

The file [samples/tsconfig.workflows.json](samples/tsconfig.workflows.json) contains a sample configuration for type checking workflow sources.

Type annotations for [Workflows standard library functions and expression helpers](https://cloud.google.com/workflows/docs/reference/stdlib/overview) and for some [connectors](https://cloud.google.com/workflows/docs/reference/googleapis) are provided in [src/typennotations/workflowslib.d.ts](src/typeannotations/workflowslib.d.ts). The path to the type annotation file is set by the `compilerOptions.paths.workflowslib` key in the tsconfig file. In practice, you should change that value to the following when you are using ts2workflows as a dependency, like this:

```json
"paths": {
  "workflowslib": ["./node_modules/ts2workflows/dist/typeannotations/workflowslib.d.ts"]
}
```

TODO: VS Code does not find the workflowslib module. Maybe create a separate npm package for the types?

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
