import { expect } from 'chai'
import * as YAML from 'yaml'
import { Subworkflow } from '../src/ast/workflows.js'
import { parseExpression } from './testutils.js'
import {
  listEx,
  numberEx,
  stringEx,
  trueEx,
  variableReferenceEx,
} from '../src/ast/expressions.js'
import { renderStep, WorkflowStep } from '../src/ast/steps.js'

describe('workflow steps', () => {
  it('renders an assign step', () => {
    const step = {
      tag: 'assign' as const,
      label: 'test1',
      assignments: [
        {
          name: variableReferenceEx('city'),
          value: stringEx('New New York'),
        },
        {
          name: variableReferenceEx('value'),
          value: parseExpression('1 + 2'),
        },
      ],
    }

    const expected = `
    test1:
      assign:
        - city: New New York
        - value: \${1 + 2}
    `

    assertRenderStep(step, expected)
  })

  it('assigns variables with index notation', () => {
    const step = {
      tag: 'assign' as const,
      label: 'test1',
      assignments: [
        {
          name: variableReferenceEx('my_list'),
          value: listEx([
            numberEx(0),
            numberEx(1),
            numberEx(2),
            numberEx(3),
            numberEx(4),
          ]),
        },
        {
          name: variableReferenceEx('idx'),
          value: numberEx(0),
        },
        {
          name: variableReferenceEx('my_list[0]'),
          value: stringEx('Value0'),
        },
        {
          name: variableReferenceEx('my_list[idx + 1]'),
          value: stringEx('Value1'),
        },
        {
          name: variableReferenceEx('my_list[len(my_list) - 1]'),
          value: stringEx('LastValue'),
        },
      ],
    }

    const expected = `
    test1:
      assign:
        - my_list: [0, 1, 2, 3, 4]
        - idx: 0
        - my_list[0]: "Value0"
        - my_list[idx + 1]: "Value1"
        - my_list[len(my_list) - 1]: "LastValue"
    `

    assertRenderStep(step, expected)
  })

  it('renders a simple call step', () => {
    const step = {
      tag: 'call' as const,
      label: 'test1',
      call: 'destination_step',
    }

    const expected = `
    test1:
      call: destination_step`

    assertRenderStep(step, expected)
  })

  it('renders a call step with arguments and result', () => {
    const step = {
      tag: 'call' as const,
      label: 'test1',
      call: 'deliver_package',
      args: {
        destination: stringEx('Atlanta'),
        deliveryCompany: stringEx('Planet Express'),
      },
      result: 'deliveryResult',
    }

    const expected = `
    test1:
      call: deliver_package
      args:
          destination: Atlanta
          deliveryCompany: Planet Express
      result: deliveryResult
    `

    assertRenderStep(step, expected)
  })

  it('renders a call step with an expression as an argument', () => {
    const step = {
      tag: 'call' as const,
      label: 'test1',
      call: 'deliver_package',
      args: {
        destination: parseExpression('destinations[i]'),
      },
    }

    const expected = `
    test1:
      call: deliver_package
      args:
          destination: \${destinations[i]}
    `

    assertRenderStep(step, expected)
  })

  it('renders a switch step', () => {
    const assign1 = {
      tag: 'assign' as const,
      label: 'increase_counter',
      assignments: [
        {
          name: variableReferenceEx('a'),
          value: parseExpression('mars_counter + 1'),
        },
      ],
    }
    const return1 = {
      tag: 'return' as const,
      label: 'return_counter',
      value: parseExpression('a'),
    }
    const step = {
      tag: 'switch' as const,
      label: 'switch1',
      branches: [
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
      next: 'end',
    }

    const expected = `
    switch1:
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
    `

    assertRenderStep(step, expected)
  })

  it('renders a try step', () => {
    const potentiallyFailingStep = {
      tag: 'call' as const,
      label: 'http_step',
      call: 'http.get',
      args: {
        url: stringEx('https://maybe.failing.test/'),
      },
      result: 'response',
    }
    const knownErrors = {
      tag: 'switch' as const,
      label: 'known_errors',
      branches: [
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            {
              tag: 'return' as const,
              label: 'return_error',
              value: stringEx('Not found'),
            },
          ],
        },
      ],
    }
    const unknownErrors = {
      tag: 'raise' as const,
      label: 'unknown_errors',
      value: parseExpression('e'),
    }
    const step = {
      tag: 'try' as const,
      label: 'try1',
      trySteps: [potentiallyFailingStep],
      exceptSteps: [knownErrors, unknownErrors],
      errorMap: 'e',
    }

    const expected = `
    try1:
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
    `

    assertRenderStep(step, expected)
  })

  it('renders a try step with a default retry policy', () => {
    const potentiallyFailingStep = {
      tag: 'call' as const,
      label: 'http_step',
      call: 'http.get',
      args: {
        url: stringEx('https://maybe.failing.test/'),
      },
      result: 'response',
    }
    const knownErrors = {
      tag: 'switch' as const,
      label: 'known_errors',
      branches: [
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            {
              tag: 'return' as const,
              label: 'return_error',
              value: stringEx('Not found'),
            },
          ],
        },
      ],
    }
    const unknownErrors = {
      tag: 'raise' as const,
      label: 'unknown_errors',
      value: parseExpression('e'),
    }
    const step = {
      tag: 'try' as const,
      label: 'try1',
      trySteps: [potentiallyFailingStep],
      exceptSteps: [knownErrors, unknownErrors],
      retryPolicy: 'http.default_retry',
      errorMap: 'e',
    }

    const expected = `
    try1:
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
    `

    assertRenderStep(step, expected)
  })

  it('renders a try step with a custom retry policy', () => {
    const potentiallyFailingStep = {
      tag: 'call' as const,
      label: 'http_step',
      call: 'http.get',
      args: {
        url: stringEx('https://maybe.failing.test/'),
      },
      result: 'response',
    }
    const knownErrors = {
      tag: 'switch' as const,
      label: 'known_errors',
      branches: [
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            {
              tag: 'return' as const,
              label: 'return_error',
              value: stringEx('Not found'),
            },
          ],
        },
      ],
    }
    const unknownErrors = {
      tag: 'raise' as const,
      label: 'unknown_errors',
      value: parseExpression('e'),
    }
    const step = {
      tag: 'try' as const,
      label: 'try1',
      trySteps: [potentiallyFailingStep],
      exceptSteps: [knownErrors, unknownErrors],
      retryPolicy: {
        predicate: 'http.default_retry',
        maxRetries: numberEx(10),
        backoff: {
          initialDelay: numberEx(0.5),
          maxDelay: numberEx(60),
          multiplier: variableReferenceEx('multiplier'),
        },
      },
      errorMap: 'e',
    }

    const expected = `
    try1:
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
              multiplier: \${multiplier}
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
    `

    assertRenderStep(step, expected)
  })

  it('renders a try step with a subworkflow as a retry predicate', () => {
    const predicateSubworkflow = new Subworkflow(
      'my_retry_predicate',
      [{ tag: 'return' as const, label: 'always_retry', value: trueEx }],
      [{ name: 'e' }],
    )
    const potentiallyFailingStep = {
      tag: 'call' as const,
      label: 'http_step',

      call: 'http.get',
      args: {
        url: stringEx('https://maybe.failing.test/'),
      },
      result: 'response',
    }
    const knownErrors = {
      tag: 'switch' as const,
      label: 'known_errors',
      branches: [
        {
          condition: parseExpression('e.code == 404'),
          steps: [
            {
              tag: 'return' as const,
              label: 'return_error',
              value: stringEx('Not found'),
            },
          ],
        },
      ],
    }
    const unknownErrors = {
      tag: 'raise' as const,
      label: 'unknown_errors',
      value: parseExpression('e'),
    }
    const step = {
      tag: 'try' as const,
      label: 'try1',
      trySteps: [potentiallyFailingStep],
      exceptSteps: [knownErrors, unknownErrors],
      retryPolicy: {
        predicate: predicateSubworkflow.name,
        maxRetries: numberEx(3),
        backoff: {
          initialDelay: numberEx(2),
          maxDelay: numberEx(60),
          multiplier: numberEx(4),
        },
      },
      errorMap: 'e',
    }

    const expected = `
    try1:
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
    `

    assertRenderStep(step, expected)
  })

  it('renders a for step', () => {
    const step = {
      tag: 'for' as const,
      label: 'test1',
      steps: [
        {
          tag: 'assign' as const,
          label: 'addStep',
          assignments: [
            {
              name: variableReferenceEx('sum'),
              value: parseExpression('sum + v'),
            },
          ],
        },
      ],
      loopVariableName: 'v',
      listExpression: listEx([numberEx(1), numberEx(2), numberEx(3)]),
    }

    const expected = `
    test1:
      for:
          value: v
          in: [1, 2, 3]
          steps:
            - addStep:
                assign:
                  - sum: \${sum + v}
    `

    assertRenderStep(step, expected)
  })

  it('renders an index-based for step', () => {
    const step = {
      tag: 'for' as const,
      label: 'test1',
      steps: [
        {
          tag: 'assign' as const,
          label: 'addStep',
          assignments: [
            {
              name: variableReferenceEx('sum'),
              value: parseExpression('sum + i*v'),
            },
          ],
        },
      ],
      loopVariableName: 'v',
      listExpression: listEx([numberEx(10), numberEx(20), numberEx(30)]),
      indexVariableName: 'i',
    }

    const expected = `
    test1:
      for:
          value: v
          index: i
          in: [10, 20, 30]
          steps:
            - addStep:
                assign:
                  - sum: \${sum + i * v}
    `

    assertRenderStep(step, expected)
  })

  it('renders a for-range step', () => {
    const step = {
      tag: 'for' as const,
      label: 'test1',
      steps: [
        {
          tag: 'assign' as const,
          label: 'addStep',
          assignments: [
            {
              name: variableReferenceEx('sum'),
              value: parseExpression('sum + v'),
            },
          ],
        },
      ],
      loopVariableName: 'v',
      rangeStart: 1,
      rangeEnd: 9,
    }

    const expected = `
    test1:
      for:
          value: v
          range: [1, 9]
          steps:
            - addStep:
                assign:
                  - sum: \${sum + v}
    `

    assertRenderStep(step, expected)
  })

  it('renders a for-range step without rangeEnd', () => {
    const step = {
      tag: 'for' as const,
      label: 'test1',
      steps: [
        {
          tag: 'assign' as const,
          label: 'addStep',
          assignments: [
            {
              name: variableReferenceEx('sum'),
              value: parseExpression('sum + v'),
            },
          ],
        },
      ],
      loopVariableName: 'v',
      rangeStart: 1,
    }

    const expected = `
    test1:
      for:
          value: v
          range: [1, null]
          steps:
            - addStep:
                assign:
                  - sum: \${sum + v}
    `

    assertRenderStep(step, expected)
  })

  it('renders parallel branches', () => {
    const step = {
      tag: 'parallel' as const,
      label: 'test1',
      branches: [
        {
          name: 'branch1',
          steps: [
            {
              tag: 'call' as const,
              label: 'say_hello_1',
              call: 'sys.log',
              args: {
                text: stringEx('Hello from branch 1'),
              },
            },
          ],
        },
        {
          name: 'branch2',
          steps: [
            {
              tag: 'call' as const,
              label: 'say_hello_2',
              call: 'sys.log',
              args: {
                text: stringEx('Hello from branch 2'),
              },
            },
          ],
        },
      ],
    }

    const expected = `
    test1:
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
    `

    assertRenderStep(step, expected)
  })

  it('renders parallel branches with shared variables and concurrency limit', () => {
    const step = {
      tag: 'parallel' as const,
      label: 'test1',
      branches: [
        {
          name: 'branch1',
          steps: [
            {
              tag: 'assign' as const,
              label: 'assign_1',
              assignments: [
                {
                  name: variableReferenceEx('myVariable[0]'),
                  value: stringEx('Set in branch 1'),
                },
              ],
            },
          ],
        },
        {
          name: 'branch2',
          steps: [
            {
              tag: 'assign' as const,
              label: 'assign_2',
              assignments: [
                {
                  name: variableReferenceEx('myVariable[1]'),
                  value: stringEx('Set in branch 2'),
                },
              ],
            },
          ],
        },
      ],
      shared: ['myVariable'],
      concurrencyLimit: 2,
    }

    const expected = `
    test1:
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
    `

    assertRenderStep(step, expected)
  })

  it('renders a parallel for step', () => {
    const step = {
      tag: 'parallel-for' as const,
      label: 'test1',
      forStep: {
        tag: 'for' as const,
        label: 'for1',
        steps: [
          {
            tag: 'call' as const,
            label: 'getBalance',
            call: 'http.get',
            args: {
              url: parseExpression('"https://example.com/balance/" + userId'),
            },
            result: 'balance',
          },
          {
            tag: 'assign' as const,
            label: 'add',
            assignments: [
              {
                name: variableReferenceEx('total'),
                value: parseExpression('total + balance'),
              },
            ],
          },
        ],
        loopVariableName: 'userId',
        listExpression: listEx([
          stringEx('11'),
          stringEx('12'),
          stringEx('13'),
          stringEx('14'),
        ]),
      },
      shared: ['total'],
    }

    const expected = `
    test1:
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
    `

    assertRenderStep(step, expected)
  })

  it('renders a parallel for step with optional parameters', () => {
    const step = {
      tag: 'parallel-for' as const,
      label: 'test1',
      forStep: {
        tag: 'for' as const,
        label: 'for1',
        steps: [
          {
            tag: 'call' as const,
            label: 'getBalance',
            call: 'http.get',
            args: {
              url: parseExpression('"https://example.com/balance/" + userId'),
            },
            result: 'balance',
          },
          {
            tag: 'assign' as const,
            label: 'add',
            assignments: [
              {
                name: variableReferenceEx('total'),
                value: parseExpression('total + balance'),
              },
            ],
          },
        ],
        loopVariableName: 'userId',
        listExpression: listEx([
          stringEx('11'),
          stringEx('12'),
          stringEx('13'),
          stringEx('14'),
        ]),
      },
      shared: ['total'],
      concurrencyLimit: 2,
      exceptionPolicy: 'continueAll',
    }

    const expected = `
    test1:
      parallel:
          shared: [total]
          concurrency_limit: 2
          exception_policy: continueAll
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
    `

    assertRenderStep(step, expected)
  })
})

function assertRenderStep(step: WorkflowStep, expected: string): void {
  expect(renderStep(step)).to.deep.equal(YAML.parse(expected))
}
