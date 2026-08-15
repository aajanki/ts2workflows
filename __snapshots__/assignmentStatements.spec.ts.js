exports['Assignment statement transpiles a const assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "a": 1
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement transpiles a let assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "a": 1
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement allows variables to be re-declared 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 5
            },
            {
              "x": 6
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement transpiles a sequence of const assignments 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "a": 1
            },
            {
              "b": 2
            },
            {
              "c": 3
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement transpiles an assignment expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "a": null
            },
            {
              "a": 1
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement property assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "person.name": "Bean"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement member expression with map literal body 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "value": 111
              }
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${__temp0.value}"
        }
      }
    ]
  }
}

exports['Assignment statement deep member expression with map literal body 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "temperature": {
                  "value": 18,
                  "unit": "Celsius"
                }
              }
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${__temp0.temperature.value}"
        }
      }
    ]
  }
}

exports['Assignment statement member expression with function call body 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "res": "${get_object().value}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement map literal in an assignment step 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "code": 56
              }
            },
            {
              "a": "${__temp0.code}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement map literal as function argument 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "name": "Bean"
              }
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${get_friends(__temp0)}"
        }
      }
    ]
  }
}

exports['Assignment statement nested map literal and functions 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "name": "Bean"
              }
            },
            {
              "data": {
                "friends": "${get_friends(__temp0)}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement nested map literal and functions 2 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "name": "Bean"
              }
            },
            {
              "__temp1": {
                "name": "Elfo"
              }
            },
            {
              "data": {
                "characters": [
                  "${get_character(__temp0)}",
                  "${get_character(__temp1)}"
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement nested map literal and functions 3 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "personId": 1
              }
            },
            {
              "data": [
                {
                  "name": "${get_name(__temp0)}"
                }
              ]
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement deeply nested map literal and functions 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "personId": 1
              }
            },
            {
              "__temp1": {
                "name": "${get_name(__temp0)}"
              }
            },
            {
              "data": {
                "friends": "${get_friends(__temp1)}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement deeply nested map literal and functions 2 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "personId": 1
              }
            },
            {
              "__temp1": {
                "name": "${get_name(__temp0)}"
              }
            },
            {
              "__temp2": {
                "personId": 2
              }
            },
            {
              "__temp3": {
                "name": "${get_name(__temp2)}"
              }
            },
            {
              "data": {
                "friends": "${get_friends([__temp1, __temp3])}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement map literal in complex expression 1'] = {
  "complex": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "codes": {
                "success": "OK"
              }
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "__temp1": {
                        "value": 5
                      }
                    }
                  ]
                }
              },
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${2 * (__temp1.value + 10) > 0}",
                      "steps": [
                        {
                          "assign3": {
                            "assign": [
                              {
                                "__temp0": {
                                  "status": "success"
                                }
                              }
                            ]
                          }
                        },
                        {
                          "return1": {
                            "return": "${codes[__temp0.status]}"
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          },
          "except": {
            "steps": [
              {
                "return2": {
                  "return": "error"
                }
              }
            ]
          }
        }
      }
    ]
  }
}

exports['Assignment statement multiple map literals in an assignment statement 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "a": [
                  1,
                  2
                ]
              }
            },
            {
              "__temp1": {
                "a": [
                  3,
                  4
                ]
              }
            },
            {
              "values[__temp0.a[0]]": "${values[__temp1.a[1]] + 1}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement multiple map literals in a call statement 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "name": "Bean"
              }
            },
            {
              "__temp1": {
                "filter": {
                  "age": "> 40"
                }
              }
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${get_friends(__temp0, __temp1)}"
        }
      }
    ]
  }
}

exports['Assignment statement extracts nested map only on one branches of combined assing step 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "name": "Bean"
              }
            },
            {
              "data": {
                "friends": "${get_friends(__temp0)}"
              }
            },
            {
              "data2": {
                "person": {
                  "name": "Bean"
                }
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement indexed assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "values[3]": 10
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement indexed assignment with a computed expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "i": 10
            },
            {
              "values[i + 1]": 10
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement indexed assignment with a function call expression as the index 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "values[getIndex()]": 10
            }
          ]
        }
      }
    ]
  },
  "getIndex": {
    "steps": [
      {
        "return1": {
          "return": 5
        }
      }
    ]
  }
}

exports['Assignment statement indexed assignment with a member expression as the index 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "indexes": {
                "first": 0
              }
            },
            {
              "values[indexes.first]": 10
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement indexed assignment with a map literal in the index 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "i": 0
              }
            },
            {
              "values[__temp0.i]": 10
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement object property assignment with a variable as a key 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "key": "name"
            },
            {
              "data[key]": "Bean"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement object property assignment with a computed expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "data[\"na\" + \"me\"]": "Bean"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement object property assignment with a computed expression with variables 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "prefix": "na"
            },
            {
              "postfix": "me"
            },
            {
              "data[prefix + postfix]": "Bean"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement assignment to a member expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "people[3].age": 38
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement assignment to a member expression with a variable index 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "i": 10
            },
            {
              "people[i].age": 38
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement addition assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0
            },
            {
              "x": "${x + 5}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement addition assignment to a member expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "people[4].age": "${people[4].age + 1}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement addition assignment to a member expression with a computed expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "i": 2
            },
            {
              "__temp0": "${4 + i}"
            },
            {
              "people[__temp0].age": "${people[__temp0].age + 1}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement compound assignment with a unary expression on LHS 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": "${-getIndex()}"
            },
            {
              "values[__temp0]": "${values[__temp0] - 1}"
            }
          ]
        }
      }
    ]
  },
  "getIndex": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Assignment statement compound assignment with a list and map expressions on LHS 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "value": [
                  1,
                  2,
                  3
                ]
              }
            },
            {
              "__temp0": "${__temp0.value[0]}"
            },
            {
              "values[__temp0]": "${values[__temp0] - 1}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement compound assignment to a member expression with side-effects 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": "${getIndex() + 4}"
            },
            {
              "values[__temp0]": "${values[__temp0] - 1}"
            }
          ]
        }
      }
    ]
  },
  "getIndex": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Assignment statement compound assignment to a member expression with many side-effects 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp1": "${objectIndex()}"
            },
            {
              "__temp0": "${valueIndex()}"
            },
            {
              "data.objects[__temp1].values[__temp0]": "${data.objects[__temp1].values[__temp0] / 2}"
            }
          ]
        }
      }
    ]
  },
  "objectIndex": {
    "steps": [
      {
        "return1": {
          "return": 2
        }
      }
    ]
  },
  "valueIndex": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Assignment statement call step in a compound assignment 1'] = {
  "main": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "call_sum_1": {
          "call": "sum",
          "args": {
            "a": 10,
            "b": 11
          },
          "result": "__temp"
        }
      },
      {
        "assign1": {
          "assign": [
            {
              "x": "${x % __temp}"
            }
          ]
        }
      }
    ]
  },
  "sum": {
    "params": [
      "a",
      "b"
    ],
    "steps": [
      {
        "return1": {
          "return": "${a + b}"
        }
      }
    ]
  }
}

exports['Assignment statement addition assignment with a complex expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": "${x + 2 * y + 10}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement substraction assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0
            },
            {
              "x": "${x - 5}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement multiplication assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 1
            },
            {
              "x": "${x * 2}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement division assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 10
            },
            {
              "x": "${x / 2}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement logical and assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": false
            },
            {
              "x": "${x and true}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement logical or assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": false
            },
            {
              "x": "${x or true}"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement merges consequtive assignments into a single step 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "a": {}
            },
            {
              "b": "test"
            },
            {
              "c": 12
            },
            {
              "d": "${c + 1}"
            },
            {
              "a.id": "1"
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement merges consequtive assignments into a single step in a nested scope 1'] = {
  "main": {
    "steps": [
      {
        "switch1": {
          "switch": [
            {
              "condition": "${2 > 1}",
              "steps": [
                {
                  "assign1": {
                    "assign": [
                      {
                        "a": {}
                      },
                      {
                        "b": "test"
                      },
                      {
                        "c": 12
                      },
                      {
                        "d": "${c + 1}"
                      },
                      {
                        "a.id": "1"
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement variable definition without initial value is treated as a null assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "a": null
            }
          ]
        }
      }
    ]
  }
}

exports['Assignment statement definite assignment is treated as a null assignment 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "a": null
            },
            {
              "a": 5
            }
          ]
        }
      }
    ]
  }
}
