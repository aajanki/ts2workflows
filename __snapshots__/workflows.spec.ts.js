exports['workflow transpiler transpiles a function with parameters 1'] = {
  "my_workflow": {
    "params": [
      "a",
      "b",
      "c"
    ],
    "steps": [
      {
        "return1": {
          "return": "${a + b + c}"
        }
      }
    ]
  }
}

exports['workflow transpiler transpiles a function with body 1'] = {
  "my_workflow": {
    "params": [
      "a"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "b": "${a + 1}"
            },
            {
              "c": "${2 * b}"
            }
          ]
        }
      }
    ]
  }
}

exports['workflow transpiler transpiles multiple subworkflows 1'] = {
  "workflow1": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  },
  "workflow2": {
    "params": [
      "first_param"
    ],
    "steps": [
      {
        "return1": {
          "return": 2
        }
      }
    ]
  }
}

exports['workflow transpiler handles function parameters with default values 1'] = {
  "greeting": {
    "params": [
      {
        "name": "world"
      }
    ],
    "steps": [
      {
        "return1": {
          "return": "${\"Hello \" + name}"
        }
      }
    ]
  }
}

exports['workflow transpiler handles function parameters with number or boolean default values 1'] = {
  "test": {
    "params": [
      {
        "value": 10
      },
      {
        "valid": true
      }
    ],
    "steps": [
      {
        "return1": {
          "return": "${value}"
        }
      }
    ]
  }
}

exports['workflow transpiler handles function parameters with falsy default values 1'] = {
  "test": {
    "params": [
      {
        "falsyString": ""
      },
      {
        "falsyNumber": 0
      },
      {
        "falsyBoolean": false
      },
      {
        "falsyNull": null
      }
    ],
    "steps": [
      {
        "return1": {
          "return": "${falsyString}"
        }
      }
    ]
  }
}

exports['workflow transpiler accepts undefined as function default value (and outputs it as null) 1'] = {
  "test": {
    "params": [
      {
        "name": null
      }
    ],
    "steps": [
      {
        "return1": {
          "return": "${default(name, \"\")}"
        }
      }
    ]
  }
}

exports['workflow transpiler accepts optional function arguments 1'] = {
  "test": {
    "params": [
      {
        "name": null
      }
    ],
    "steps": [
      {
        "return1": {
          "return": "${default(name, \"\")}"
        }
      }
    ]
  }
}

exports['workflow transpiler handles function with positional and optional parameters 1'] = {
  "my_workflow": {
    "params": [
      "positional_arg",
      {
        "optional_arg": 100
      }
    ],
    "steps": [
      {
        "return1": {
          "return": null
        }
      }
    ]
  }
}
