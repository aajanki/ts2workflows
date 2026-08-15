exports['Type annotations accepts type annotations on variable declaration 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "greeting": "Hi, I'm Elfo!"
            }
          ]
        }
      }
    ]
  }
}

exports['Type annotations accepts function parameter and return type annotations 1'] = {
  "addOne": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "return1": {
          "return": "${x + 1}"
        }
      }
    ]
  }
}

exports['Type annotations ignores interface declaration 1'] = {}

exports['Type annotations ignores type declaration 1'] = {}

exports['Type annotations ignores non-null assertions 1'] = {
  "getName": {
    "params": [
      "person"
    ],
    "steps": [
      {
        "return1": {
          "return": "${person.name}"
        }
      }
    ]
  }
}

exports['Type definitions ignores type alias on the top level 1'] = {
  "main": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Type definitions ignores type alias inside a function 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "p": {
                "name": "Bean"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Type definitions ignores interface on the top level 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "p": {
                "name": "Bean"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Type definitions ignores interface inside a function 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "p": {
                "name": "Bean"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Generics accepts generics in function calls 1'] = {
  "main": {
    "steps": [
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://example.com/cities/LON"
          },
          "result": "city"
        }
      }
    ]
  }
}

exports['Generics accepts generics in assignment steps 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "name": "${getName()}"
            }
          ]
        }
      }
    ]
  }
}

exports['Generics transpiles type instantiation expressions 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "func": "${getName}"
            }
          ]
        }
      }
    ]
  }
}

exports['Generics transpiles type instantiation expressions in call_step 1'] = {
  "main": {
    "steps": [
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://example.com/cities/LON"
          },
          "result": "city"
        }
      }
    ]
  }
}

exports['Function definition accepts "export function" 1'] = {
  "main": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Function definition accepts but ignores async and await 1'] = {
  "workflow1": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "result": "${workflow2()}"
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${result}"
        }
      }
    ]
  },
  "workflow2": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Function definition ignores function declaration 1'] = {}

exports['Function definition accepts nested block statements 1'] = {
  "test": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Compiler intrinsics Array.isArray(x) is converted to get_type(x) == "list" 1'] = {
  "main": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "return1": {
          "return": "${get_type(x) == \"list\"}"
        }
      }
    ]
  }
}

exports['Compiler intrinsics Array.isArray(x) in a nested expression 1'] = {
  "main": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "return1": {
          "return": {
            "type": "${if(get_type(x) == \"list\", \"array\", \"not array\")}"
          }
        }
      }
    ]
  }
}

exports['Compiler intrinsics nested Array.isArray() calls 1'] = {
  "main": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "return1": {
          "return": "${get_type(get_type(x) == \"list\") == \"list\"}"
        }
      }
    ]
  }
}

exports['Compiler intrinsics Array.includes(arr, x) is converted to x in arr 1'] = {
  "main": {
    "params": [
      "arr"
    ],
    "steps": [
      {
        "return1": {
          "return": "${55 in arr}"
        }
      }
    ]
  }
}
