# Typescript to GCP Workflows transpiler

Status: This project is under development. Not ready for production use yet!

ts2workflows converts Typescript code to a [GCP Workflows](https://cloud.google.com/workflows/docs/apis) program.

Only a subset of Typescript features are supported. The [language reference](language_reference.md) shows the supported Typescript features.

See the [samples](samples) directory for code examples.

## Build

```
npm install
npm run build
```

## Run unit tests

```
npm run test
```

## Type checking

One benefit of writing the workflow programs in Typescript is that the sources can be type checked. Type annotations for [Workflows standard library functions and expression helpers](https://cloud.google.com/workflows/docs/reference/stdlib/overview) are provided in the directory [typennotations](typeannotations).

This is an example command that shows how to type check source files in the samples directory. [tsconfig.workflows.json](tsconfig.workflows.json) contains a sample configuration for tsc. The command will print typing errors or finish without printing anything, if there are no typing errors.

```
npx tsc --project tsconfig.workflows.json
```

## Command for transpiling a Typescript file to Workflows syntax

```
npx tsx src/cli.ts samples/sample1.ts
```

## License

[The MIT License](LICENSE)
