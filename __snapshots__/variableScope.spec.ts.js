exports['Variable scope variable can be accessed in sub-blocks 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 5
            },
            {
              "x": "${x + 1}"
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${x}"
        }
      }
    ]
  }
}

exports['Variable scope variable can be accessed in if-blocks 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 5
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${2 > 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "x": "${x + 1}"
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${x}"
        }
      }
    ]
  }
}

exports['Variable scope const and let variables have function scope (unlike TypeScript) 1'] = {
  "test": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x > 0}",
              "steps": [
                {
                  "assign1": {
                    "assign": [
                      {
                        "res": "positive"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": true,
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "res": "non-positive"
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${res}"
        }
      }
    ]
  }
}

exports['Variable scope uninitialized variables are set to null 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": null
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${x}"
        }
      }
    ]
  }
}

exports['Variable scope variable read before it is assigned 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "y": "${x + 1}"
            },
            {
              "x": 1
            }
          ]
        }
      }
    ]
  }
}
