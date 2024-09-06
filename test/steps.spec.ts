/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { expect } from 'chai'
import * as YAML from 'yaml'
import { Subworkflow } from '../src/ast/workflows.js'
import { namedStep, parseExpression } from './testutils.js'
import {
  AssignStepAST,
  CallStepAST,
  ForStepASTNamed,
  ParallelStepASTNamed,
  RaiseStepAST,
  ReturnStepAST,
  StepsStepASTNamed,
  SwitchStepASTNamed,
  TryStepASTNamed,
  renderStep,
} from '../src/ast/steps.js'
import { PrimitiveExpression } from '../src/ast/expressions.js'

describe('workflow step AST', () => {
  it('renders an assign step', () => {
    const step = new AssignStepAST([
      ['city', new PrimitiveExpression('New New York')],
      ['value', parseExpression('1 + 2')],
    ])

    const expected = YAML.parse(`
    assign:
      - city: New New York
      - value: \${1 + 2}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('assigns variables with index notation', () => {
    const step = new AssignStepAST([
      ['my_list', new PrimitiveExpression([0, 1, 2, 3, 4])],
      ['idx', new PrimitiveExpression(0)],
      ['my_list[0]', new PrimitiveExpression('Value0')],
      ['my_list[idx + 1]', new PrimitiveExpression('Value1')],
      ['my_list[len(my_list) - 1]', new PrimitiveExpression('LastValue')],
    ])

    const expected = YAML.parse(`
    assign:
      - my_list: [0, 1, 2, 3, 4]
      - idx: 0
      - my_list[0]: "Value0"
      - my_list[idx + 1]: "Value1"
      - my_list[len(my_list) - 1]: "LastValue"
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a simple call step', () => {
    const step = new CallStepAST('destination_step')

    const expected = YAML.parse(`
    call: destination_step
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a call step with arguments and result', () => {
    const step = new CallStepAST(
      'deliver_package',
      {
        destination: new PrimitiveExpression('Atlanta'),
        deliveryCompany: new PrimitiveExpression('Planet Express'),
      },
      'deliveryResult',
    )

    const expected = YAML.parse(`
    call: deliver_package
    args:
        destination: Atlanta
        deliveryCompany: Planet Express
    result: deliveryResult
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a call step with an expression as an argument', () => {
    const step = new CallStepAST('deliver_package', {
      destination: parseExpression('destinations[i]'),
    })

    const expected = YAML.parse(`
    call: deliver_package
    args:
        destination: \${destinations[i]}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a switch step', () => {
    const assign1 = namedStep(
      'increase_counter',
      new AssignStepAST([['a', parseExpression('mars_counter + 1')]]),
    )
    const return1 = namedStep(
      'return_counter',
      new ReturnStepAST(parseExpression('a')),
    )
    const { step } = namedStep(
      'step1',
      new SwitchStepASTNamed(
        [
          {
            condition: parseExpression('city == "New New York"'),
            steps: [],
            next: 'destination_new_new_york',
          },
          {
            condition: parseExpression('city == "Mars Vegas"'),
            steps: [assign1, return1],
          },
        ],
        'end',
      ),
    )

    const expected2 = YAML.parse(`
    switch:
        - condition: \${city == "New New York"}
          next: destination_new_new_york
        - condition: \${city == "Mars Vegas"}
          steps:
            - increase_counter:
                assign:
                  - a: \${mars_counter + 1}
            - return_counter:
                return: \${a}
    next: end
    `)

    expect(renderStep(step)).to.deep.equal(expected2)
  })

  it('renders a try step', () => {
    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStepAST(
        'http.get',
        {
          url: new PrimitiveExpression('https://maybe.failing.test/'),
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStepASTNamed([
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            namedStep(
              'return_error',
              new ReturnStepAST(new PrimitiveExpression('Not found')),
            ),
          ],
        },
      ]),
    )
    const unknownErrors = namedStep(
      'unknown_errors',
      new RaiseStepAST(parseExpression('e')),
    )
    const step = new TryStepASTNamed(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      undefined,
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a try step with a default retry policy', () => {
    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStepAST(
        'http.get',
        {
          url: new PrimitiveExpression('https://maybe.failing.test/'),
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStepASTNamed([
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            namedStep(
              'return_error',
              new ReturnStepAST(new PrimitiveExpression('Not found')),
            ),
          ],
        },
      ]),
    )
    const unknownErrors = namedStep(
      'unknown_errors',
      new RaiseStepAST(parseExpression('e')),
    )
    const step = new TryStepASTNamed(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      'http.default_retry',
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    retry: \${http.default_retry}
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a try step with a custom retry policy', () => {
    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStepAST(
        'http.get',
        {
          url: new PrimitiveExpression('https://maybe.failing.test/'),
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStepASTNamed([
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            namedStep(
              'return_error',
              new ReturnStepAST(new PrimitiveExpression('Not found')),
            ),
          ],
        },
      ]),
    )
    const unknownErrors = namedStep(
      'unknown_errors',
      new RaiseStepAST(parseExpression('e')),
    )
    const step = new TryStepASTNamed(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      {
        predicate: 'http.default_retry',
        maxRetries: 10,
        backoff: {
          initialDelay: 0.5,
          maxDelay: 60,
          multiplier: 2,
        },
      },
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    retry:
        predicate: \${http.default_retry}
        max_retries: 10
        backoff:
            initial_delay: 0.5
            max_delay: 60
            multiplier: 2
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a try step with a subworkflow as a retry predicate', () => {
    const predicateSubworkflow = new Subworkflow(
      'my_retry_predicate',
      [
        namedStep(
          'always_retry',
          new ReturnStepAST(new PrimitiveExpression(true)),
        ),
      ],
      [{ name: 'e' }],
    )

    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStepAST(
        'http.get',
        {
          url: new PrimitiveExpression('https://maybe.failing.test/'),
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStepASTNamed([
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            namedStep(
              'return_error',
              new ReturnStepAST(new PrimitiveExpression('Not found')),
            ),
          ],
        },
      ]),
    )
    const unknownErrors = namedStep(
      'unknown_errors',
      new RaiseStepAST(parseExpression('e')),
    )
    const step = new TryStepASTNamed(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      {
        predicate: predicateSubworkflow.name,
        maxRetries: 3,
        backoff: {
          initialDelay: 2,
          maxDelay: 60,
          multiplier: 4,
        },
      },
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    retry:
        predicate: \${my_retry_predicate}
        max_retries: 3
        backoff:
            initial_delay: 2
            max_delay: 60
            multiplier: 4
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a for step', () => {
    const step = new ForStepASTNamed(
      [
        namedStep(
          'addStep',
          new AssignStepAST([['sum', parseExpression('sum + v')]]),
        ),
      ],
      'v',
      new PrimitiveExpression([1, 2, 3]),
    )

    const expected = YAML.parse(`
    for:
        value: v
        in: [1, 2, 3]
        steps:
          - addStep:
              assign:
                - sum: \${sum + v}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders an index-based for step', () => {
    const step = new ForStepASTNamed(
      [
        namedStep(
          'addStep',
          new AssignStepAST([['sum', parseExpression('sum + i*v')]]),
        ),
      ],
      'v',
      new PrimitiveExpression([10, 20, 30]),
      'i',
    )

    const expected = YAML.parse(`
    for:
        value: v
        index: i
        in: [10, 20, 30]
        steps:
          - addStep:
              assign:
                - sum: \${sum + i * v}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a for-range step', () => {
    const step = new ForStepASTNamed(
      [
        namedStep(
          'addStep',
          new AssignStepAST([['sum', parseExpression('sum + v')]]),
        ),
      ],
      'v',
      undefined,
      undefined,
      1,
      9,
    )

    const expected = YAML.parse(`
    for:
        value: v
        range: [1, 9]
        steps:
          - addStep:
              assign:
                - sum: \${sum + v}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders parallel branches', () => {
    const step = new ParallelStepASTNamed({
      branch1: new StepsStepASTNamed([
        namedStep(
          'say_hello_1',
          new CallStepAST('sys.log', {
            text: new PrimitiveExpression('Hello from branch 1'),
          }),
        ),
      ]),
      branch2: new StepsStepASTNamed([
        namedStep(
          'say_hello_2',
          new CallStepAST('sys.log', {
            text: new PrimitiveExpression('Hello from branch 2'),
          }),
        ),
      ]),
    })

    const expected = YAML.parse(`
    parallel:
        branches:
          - branch1:
              steps:
                - say_hello_1:
                    call: sys.log
                    args:
                        text: Hello from branch 1
          - branch2:
              steps:
                - say_hello_2:
                    call: sys.log
                    args:
                        text: Hello from branch 2
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders parallel branches with shared variables and concurrency limit', () => {
    const step = new ParallelStepASTNamed(
      {
        branch1: new StepsStepASTNamed([
          namedStep(
            'assign_1',
            new AssignStepAST([
              ['myVariable[0]', new PrimitiveExpression('Set in branch 1')],
            ]),
          ),
        ]),
        branch2: new StepsStepASTNamed([
          namedStep(
            'assign_2',
            new AssignStepAST([
              ['myVariable[1]', new PrimitiveExpression('Set in branch 2')],
            ]),
          ),
        ]),
      },
      ['myVariable'],
      2,
    )

    const expected = YAML.parse(`
    parallel:
        shared: [myVariable]
        concurrency_limit: 2
        branches:
          - branch1:
              steps:
                - assign_1:
                    assign:
                      - myVariable[0]: 'Set in branch 1'
          - branch2:
              steps:
                - assign_2:
                    assign:
                      - myVariable[1]: 'Set in branch 2'
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })

  it('renders a parallel for step', () => {
    const step = new ParallelStepASTNamed(
      new ForStepASTNamed(
        [
          namedStep(
            'getBalance',
            new CallStepAST(
              'http.get',
              {
                url: parseExpression('"https://example.com/balance/" + userId'),
              },
              'balance',
            ),
          ),
          namedStep(
            'add',
            new AssignStepAST([['total', parseExpression('total + balance')]]),
          ),
        ],
        'userId',
        new PrimitiveExpression(['11', '12', '13', '14']),
      ),
      ['total'],
    )

    const expected = YAML.parse(`
    parallel:
        shared: [total]
        for:
            value: userId
            in: ['11', '12', '13', '14']
            steps:
              - getBalance:
                  call: http.get
                  args:
                      url: \${"https://example.com/balance/" + userId}
                  result: balance
              - add:
                  assign:
                    - total: \${total + balance}
    `)

    expect(renderStep(step)).to.deep.equal(expected)
  })
})
