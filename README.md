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

## Command for transpiling a Typescript file to Workflows syntax

```
npx tsx src/cli.ts samples/sample1.ts
```

## License

[The MIT License](LICENSE)
