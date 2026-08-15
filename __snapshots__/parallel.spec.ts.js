exports['Parallel statement outputs parallel steps 1'] = {
  "main": {
    "steps": [
      {
        "parallel1": {
          "parallel": {
            "branches": [
              {
                "branch1": {
                  "steps": [
                    {
                      "assign1": {
                        "assign": [
                          {
                            "__temp_parallel1": "${log(\"Hello from branch 1\")}"
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                "branch2": {
                  "steps": [
                    {
                      "assign2": {
                        "assign": [
                          {
                            "__temp_parallel1": "${log(\"Hello from branch 2\")}"
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                "branch3": {
                  "steps": [
                    {
                      "assign3": {
                        "assign": [
                          {
                            "__temp_parallel1": "${log(\"Hello from branch 3\")}"
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    ]
  }
}

exports['Parallel statement calls subworkflows by name 1'] = {
  "main": {
    "steps": [
      {
        "parallel1": {
          "parallel": {
            "branches": [
              {
                "branch1": {
                  "steps": [
                    {
                      "call_branch1_1": {
                        "call": "branch1"
                      }
                    }
                  ]
                }
              },
              {
                "branch2": {
                  "steps": [
                    {
                      "call_branch2_1": {
                        "call": "branch2"
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    ]
  },
  "branch1": {
    "steps": [
      {
        "return1": {
          "return": "A"
        }
      }
    ]
  },
  "branch2": {
    "steps": [
      {
        "return1": {
          "return": "B"
        }
      }
    ]
  }
}

exports['Parallel statement handles optional shared variables parameter 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "results": {}
            }
          ]
        }
      },
      {
        "parallel1": {
          "parallel": {
            "branches": [
              {
                "branch1": {
                  "steps": [
                    {
                      "assign2": {
                        "assign": [
                          {
                            "results.branch1": "hello from branch 1"
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                "branch2": {
                  "steps": [
                    {
                      "assign3": {
                        "assign": [
                          {
                            "results.branch2": "hello from branch 2"
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ],
            "shared": [
              "results"
            ]
          }
        }
      }
    ]
  }
}

exports['Parallel statement handles optional shared variables, exception policy and concurrency limit 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "results": {}
            }
          ]
        }
      },
      {
        "parallel1": {
          "parallel": {
            "branches": [
              {
                "branch1": {
                  "steps": [
                    {
                      "assign2": {
                        "assign": [
                          {
                            "results.branch1": "hello from branch 1"
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                "branch2": {
                  "steps": [
                    {
                      "assign3": {
                        "assign": [
                          {
                            "results.branch2": "hello from branch 2"
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ],
            "shared": [
              "results"
            ],
            "concurrency_limit": 2,
            "exception_policy": "continueAll"
          }
        }
      }
    ]
  }
}

exports['Parallel statement outputs parallel iteration if called with a for..of loop in an arrow function 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "total": 0
            }
          ]
        }
      },
      {
        "parallel1": {
          "parallel": {
            "for": {
              "value": "accountId",
              "in": [
                "11",
                "22",
                "33",
                "44"
              ],
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "total": "${total + getBalance(acccountId)}"
                      }
                    ]
                  }
                }
              ]
            },
            "shared": [
              "total"
            ]
          }
        }
      }
    ]
  }
}
