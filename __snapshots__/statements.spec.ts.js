exports['If statement if statement 1'] = {
  "main": {
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
                  "call_sys_log_1": {
                    "call": "sys.log",
                    "args": {
                      "data": "positive"
                    }
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

exports['If statement if-else statement 1'] = {
  "main": {
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
                  "return1": {
                    "return": "positive"
                  }
                }
              ]
            },
            {
              "condition": true,
              "steps": [
                {
                  "return2": {
                    "return": "non-positive"
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

exports['If statement if statement with multiple branches 1'] = {
  "main": {
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
                  "return1": {
                    "return": "positive"
                  }
                }
              ]
            },
            {
              "condition": "${x == 0}",
              "steps": [
                {
                  "return2": {
                    "return": "zero"
                  }
                }
              ]
            },
            {
              "condition": true,
              "steps": [
                {
                  "return3": {
                    "return": "negative"
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

exports['If statement if with a non-block statement 1'] = {
  "main": {
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
                  "return1": {
                    "return": "positive"
                  }
                }
              ]
            },
            {
              "condition": true,
              "steps": [
                {
                  "return2": {
                    "return": "non-positive"
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

exports['If statement if with an empty body 1'] = {
  "main": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "isPositive": true
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x > 0}",
              "steps": []
            },
            {
              "condition": true,
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "isPositive": false
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

exports['Switch statement switch statement 1'] = {
  "main": {
    "params": [
      "person"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "country": null
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${person == \"Bean\"}",
              "next": "assign2"
            },
            {
              "condition": "${person == \"Zøg\"}",
              "next": "assign2"
            },
            {
              "condition": "${person == \"Merkimer\"}",
              "next": "assign3"
            },
            {
              "condition": true,
              "next": "assign4"
            }
          ]
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "country": "Dreamland"
            }
          ],
          "next": "return1"
        }
      },
      {
        "assign3": {
          "assign": [
            {
              "country": "Bentwood"
            }
          ],
          "next": "return1"
        }
      },
      {
        "assign4": {
          "assign": [
            {
              "country": "unknown"
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${country}"
        }
      }
    ]
  }
}

exports['Switch statement switch statement as the last statement in a block 1'] = {
  "main": {
    "params": [
      "person"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "country": null
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${person == \"Bean\"}",
              "next": "assign2"
            },
            {
              "condition": "${person == \"Zøg\"}",
              "next": "assign2"
            },
            {
              "condition": "${person == \"Merkimer\"}",
              "next": "assign3"
            },
            {
              "condition": true,
              "next": "assign4"
            }
          ]
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "country": "Dreamland"
            }
          ],
          "next": "end"
        }
      },
      {
        "assign3": {
          "assign": [
            {
              "country": "Bentwood"
            }
          ],
          "next": "end"
        }
      },
      {
        "assign4": {
          "assign": [
            {
              "country": "unknown"
            }
          ]
        }
      }
    ]
  }
}

exports['Switch statement switch statement as a last statement in a nested block 1'] = {
  "main": {
    "params": [
      "person"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "country": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${person == \"Bean\"}",
                      "next": "assign2"
                    },
                    {
                      "condition": "${person == \"Zøg\"}",
                      "next": "assign2"
                    },
                    {
                      "condition": "${person == \"Merkimer\"}",
                      "next": "assign3"
                    },
                    {
                      "condition": true,
                      "next": "assign4"
                    }
                  ]
                }
              },
              {
                "assign2": {
                  "assign": [
                    {
                      "country": "Dreamland"
                    }
                  ],
                  "next": "return1"
                }
              },
              {
                "assign3": {
                  "assign": [
                    {
                      "country": "Bentwood"
                    }
                  ],
                  "next": "return1"
                }
              },
              {
                "assign4": {
                  "assign": [
                    {
                      "country": "unknown"
                    }
                  ]
                }
              }
            ]
          },
          "except": {
            "as": "e",
            "steps": [
              {
                "assign5": {
                  "assign": [
                    {
                      "country": "error"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "return1": {
          "return": "${country}"
        }
      }
    ]
  }
}

exports['Switch statement fall-through 1'] = {
  "main": {
    "params": [
      "person"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "country": null
            },
            {
              "royal": false
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${person == \"Bean\"}",
              "next": "assign2"
            },
            {
              "condition": "${person == \"Sorcerio\"}",
              "next": "assign3"
            },
            {
              "condition": true,
              "next": "assign4"
            }
          ]
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "royal": true
            }
          ]
        }
      },
      {
        "assign3": {
          "assign": [
            {
              "country": "Dreamland"
            }
          ],
          "next": "return1"
        }
      },
      {
        "assign4": {
          "assign": [
            {
              "country": "unknown"
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${country}"
        }
      }
    ]
  }
}

exports['Switch statement fall-through as the last case 1'] = {
  "main": {
    "params": [
      "person"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "royal": false
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${person == \"Bean\"}",
              "next": "assign2"
            },
            {
              "condition": "${person == \"Sorcerio\"}",
              "next": "return1"
            },
            {
              "condition": true,
              "next": "return1"
            }
          ]
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "royal": true
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${royal}"
        }
      }
    ]
  }
}

exports['Return statement return statement without a value 1'] = {
  "main": {
    "steps": [
      {
        "return1": {
          "next": "end"
        }
      }
    ]
  }
}

exports['Return statement return a literal value 1'] = {
  "main": {
    "steps": [
      {
        "return1": {
          "return": "OK"
        }
      }
    ]
  }
}

exports['Return statement return an expression 1'] = {
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

exports['Return statement return a map 1'] = {
  "main": {
    "steps": [
      {
        "return1": {
          "return": {
            "result": "OK",
            "value": 1
          }
        }
      }
    ]
  }
}

exports['Return statement return a list of maps 1'] = {
  "main": {
    "steps": [
      {
        "return1": {
          "return": [
            {
              "result": "OK",
              "value": 1
            }
          ]
        }
      }
    ]
  }
}

exports['Return statement return a variable reference inside a map 1'] = {
  "main": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "return1": {
          "return": {
            "value": "${x}"
          }
        }
      }
    ]
  }
}

exports['Return statement return a member of a map 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "value": 5
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

exports['Empty statement accepts an empty statement in a function 1'] = {
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

exports['Empty statement accepts empty statements at top level 1'] = {
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

exports['Labelled statement labels steps 1'] = {
  "signString": {
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
                  "positive": {
                    "return": "x is positive"
                  }
                }
              ]
            },
            {
              "condition": true,
              "steps": [
                {
                  "nonpositive": {
                    "return": "x is not positive"
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

exports['Labelled statement takes the first label when combining assignment steps 1'] = {
  "test": {
    "steps": [
      {
        "setImportantVariable": {
          "assign": [
            {
              "a": 1
            },
            {
              "b": 2
            },
            {
              "c": 3
            },
            {
              "d": 4
            }
          ]
        }
      }
    ]
  }
}

exports['Labelled statement temporary variables inside nested parallel steps should have a postfix 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${log(\"Before parallel\")}"
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
                      "parallel2": {
                        "parallel": {
                          "branches": [
                            {
                              "branch1": {
                                "steps": [
                                  {
                                    "assign2": {
                                      "assign": [
                                        {
                                          "__temp_parallel2": "${log(\"Hello from nested branch 1\")}"
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
                                          "__temp_parallel2": "${log(\"Hello from nested branch 2\")}"
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
              },
              {
                "branch2": {
                  "steps": [
                    {
                      "assign4": {
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

exports['Debugger statement ignores debugger statement 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 1
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${x + 1}"
        }
      }
    ]
  }
}
