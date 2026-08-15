exports['Destructing destructures array elements 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getValues()}"
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": "${__temp[1]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": null
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
                  "assign4": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
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

exports['Destructing destructuring the head of array 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getValues()}"
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "head": "${__temp[0]}"
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
                  "assign3": {
                    "assign": [
                      {
                        "head": null
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

exports['Destructing destructures array from call_step() 1'] = {
  "main": {
    "steps": [
      {
        "call_test_array_1": {
          "call": "test_array",
          "args": {
            "id": 1
          },
          "result": "__temp"
        }
      },
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "head": "${__temp[0]}"
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
                  "assign3": {
                    "assign": [
                      {
                        "head": null
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
  },
  "test_array": {
    "params": [
      "id"
    ],
    "steps": [
      {
        "return1": {
          "return": [
            "${id}"
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures array in a nested property 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(data.arr)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "a": "${data.arr[0]}"
                      },
                      {
                        "b": "${data.arr[1]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "a": "${data.arr[0]}"
                      },
                      {
                        "b": null
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
                  "assign4": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
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

exports['Destructing array destructuring overwriting itself 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "arr": [
                1,
                2,
                3
              ]
            },
            {
              "__temp_len": "${len(arr)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "arr[1]": "${arr[0]}"
                      },
                      {
                        "arr[0]": "${arr[1]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "arr[1]": "${arr[0]}"
                      },
                      {
                        "arr[0]": null
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
                  "assign4": {
                    "assign": [
                      {
                        "arr[1]": null
                      },
                      {
                        "arr[0]": null
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

exports['Destructing array destructuring with skipped elements 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "arr": [
                1,
                2,
                3,
                4
              ]
            },
            {
              "__temp_len": "${len(arr)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 4}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "a": "${arr[1]}"
                      },
                      {
                        "b": "${arr[3]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "a": "${arr[1]}"
                      },
                      {
                        "b": null
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
                  "assign4": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
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

exports['Destructing variable swap trick 1'] = {
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
              "__temp": [
                "${b}",
                "${a}"
              ]
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": "${__temp[1]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": null
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
                  "assign4": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
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

exports['Destructing array elements swap trick 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "arr": [
                1,
                2,
                3
              ]
            },
            {
              "__temp": [
                "${arr[1]}",
                "${arr[2]}"
              ]
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "arr[2]": "${__temp[0]}"
                      },
                      {
                        "arr[1]": "${__temp[1]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "arr[2]": "${__temp[0]}"
                      },
                      {
                        "arr[1]": null
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
                  "assign4": {
                    "assign": [
                      {
                        "arr[2]": null
                      },
                      {
                        "arr[1]": null
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

exports['Destructing destructures nested arrays 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(data)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[0])}"
                      }
                    ]
                  }
                },
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign3": {
                              "assign": [
                                {
                                  "a": "${data[0][0]}"
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
                            "assign4": {
                              "assign": [
                                {
                                  "a": null
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
                  "assign5": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[1])}"
                      }
                    ]
                  }
                },
                {
                  "switch3": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign6": {
                              "assign": [
                                {
                                  "b": "${data[1][0]}"
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
                            "assign7": {
                              "assign": [
                                {
                                  "b": null
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
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign8": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[0])}"
                      }
                    ]
                  }
                },
                {
                  "switch4": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign9": {
                              "assign": [
                                {
                                  "a": "${data[0][0]}"
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
                            "assign10": {
                              "assign": [
                                {
                                  "a": null
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
                  "assign11": {
                    "assign": [
                      {
                        "b": null
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
                  "assign12": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
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

exports['Destructing default values in array destructuring 1'] = {
  "main": {
    "params": [
      "arr"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(arr)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "a": "${arr[0]}"
                      },
                      {
                        "b": "${arr[1]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "a": "${arr[0]}"
                      },
                      {
                        "b": 99
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
                  "assign4": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": 99
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

exports['Destructing rest element in array destructuring 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getValues()}"
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 3}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": "${__temp[1]}"
                      },
                      {
                        "rest": []
                      }
                    ]
                  }
                },
                {
                  "for1": {
                    "for": {
                      "value": "__temp_index",
                      "range": [
                        2,
                        "${__temp_len - 1}"
                      ],
                      "steps": [
                        {
                          "assign3": {
                            "assign": [
                              {
                                "rest": "${list.concat(rest, __temp[__temp_index])}"
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
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign4": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": "${__temp[1]}"
                      },
                      {
                        "rest": []
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign5": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": null
                      },
                      {
                        "rest": []
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
                  "assign6": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
                      },
                      {
                        "rest": []
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

exports['Destructing rest element as the only pattern 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getValues()}"
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "values": []
                      }
                    ]
                  }
                },
                {
                  "for1": {
                    "for": {
                      "value": "__temp_index",
                      "range": [
                        0,
                        "${__temp_len - 1}"
                      ],
                      "steps": [
                        {
                          "assign3": {
                            "assign": [
                              {
                                "values": "${list.concat(values, __temp[__temp_index])}"
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
            {
              "condition": true,
              "steps": [
                {
                  "assign4": {
                    "assign": [
                      {
                        "values": []
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

exports['Destructing rest element and holes in array destructuring 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getValues()}"
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 6}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": "${__temp[3]}"
                      },
                      {
                        "rest": []
                      }
                    ]
                  }
                },
                {
                  "for1": {
                    "for": {
                      "value": "__temp_index",
                      "range": [
                        5,
                        "${__temp_len - 1}"
                      ],
                      "steps": [
                        {
                          "assign3": {
                            "assign": [
                              {
                                "rest": "${list.concat(rest, __temp[__temp_index])}"
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
            {
              "condition": "${__temp_len >= 4}",
              "steps": [
                {
                  "assign4": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": "${__temp[3]}"
                      },
                      {
                        "rest": []
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign5": {
                    "assign": [
                      {
                        "a": "${__temp[0]}"
                      },
                      {
                        "b": null
                      },
                      {
                        "rest": []
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
                  "assign6": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
                      },
                      {
                        "rest": []
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

exports['Destructing rest element in nested array patterns 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(data)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 3}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[0])}"
                      }
                    ]
                  }
                },
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign3": {
                              "assign": [
                                {
                                  "a": "${data[0][0]}"
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
                            "assign4": {
                              "assign": [
                                {
                                  "a": null
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
                  "assign5": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[1])}"
                      }
                    ]
                  }
                },
                {
                  "switch3": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 2}",
                        "steps": [
                          {
                            "assign6": {
                              "assign": [
                                {
                                  "b": "${data[1][0]}"
                                },
                                {
                                  "rest2": []
                                }
                              ]
                            }
                          },
                          {
                            "for1": {
                              "for": {
                                "value": "__temp_index",
                                "range": [
                                  1,
                                  "${__temp_len - 1}"
                                ],
                                "steps": [
                                  {
                                    "assign7": {
                                      "assign": [
                                        {
                                          "rest2": "${list.concat(rest2, data[1][__temp_index])}"
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
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign8": {
                              "assign": [
                                {
                                  "b": "${data[1][0]}"
                                },
                                {
                                  "rest2": []
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
                            "assign9": {
                              "assign": [
                                {
                                  "b": null
                                },
                                {
                                  "rest2": []
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
                  "assign10": {
                    "assign": [
                      {
                        "otherValues": []
                      }
                    ]
                  }
                },
                {
                  "for2": {
                    "for": {
                      "value": "__temp_index",
                      "range": [
                        2,
                        "${__temp_len - 1}"
                      ],
                      "steps": [
                        {
                          "assign11": {
                            "assign": [
                              {
                                "otherValues": "${list.concat(otherValues, data[__temp_index])}"
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
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign12": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[0])}"
                      }
                    ]
                  }
                },
                {
                  "switch4": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign13": {
                              "assign": [
                                {
                                  "a": "${data[0][0]}"
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
                            "assign14": {
                              "assign": [
                                {
                                  "a": null
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
                  "assign15": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[1])}"
                      }
                    ]
                  }
                },
                {
                  "switch5": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 2}",
                        "steps": [
                          {
                            "assign16": {
                              "assign": [
                                {
                                  "b": "${data[1][0]}"
                                },
                                {
                                  "rest2": []
                                }
                              ]
                            }
                          },
                          {
                            "for3": {
                              "for": {
                                "value": "__temp_index",
                                "range": [
                                  1,
                                  "${__temp_len - 1}"
                                ],
                                "steps": [
                                  {
                                    "assign17": {
                                      "assign": [
                                        {
                                          "rest2": "${list.concat(rest2, data[1][__temp_index])}"
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
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign18": {
                              "assign": [
                                {
                                  "b": "${data[1][0]}"
                                },
                                {
                                  "rest2": []
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
                            "assign19": {
                              "assign": [
                                {
                                  "b": null
                                },
                                {
                                  "rest2": []
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
                  "assign20": {
                    "assign": [
                      {
                        "otherValues": []
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign21": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[0])}"
                      }
                    ]
                  }
                },
                {
                  "switch6": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign22": {
                              "assign": [
                                {
                                  "a": "${data[0][0]}"
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
                            "assign23": {
                              "assign": [
                                {
                                  "a": null
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
                  "assign24": {
                    "assign": [
                      {
                        "b": null
                      },
                      {
                        "rest2": []
                      },
                      {
                        "otherValues": []
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
                  "assign25": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
                      },
                      {
                        "rest2": []
                      },
                      {
                        "otherValues": []
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

exports['Destructing empty array pattern 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "arr": [
                1,
                2,
                3
              ]
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing array pattern with only holes 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "arr": [
                1,
                2,
                3
              ]
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures object patterns nested in an array pattern 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(data)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "name": "${map.get(data[0], \"name\")}"
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
                  "assign3": {
                    "assign": [
                      {
                        "name": null
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

exports['Destructing destructures a nested rest element object pattern in an array pattern 1'] = {
  "main": {
    "params": [
      "arr"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(arr)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "name": "${map.get(arr[0], \"name\")}"
                      },
                      {
                        "rest": "${map.delete(arr[0], \"name\")}"
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
                  "assign3": {
                    "assign": [
                      {
                        "name": null
                      },
                      {
                        "rest": null
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

exports['Destructing destructures objects 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getPerson()}"
            },
            {
              "name": "${map.get(__temp, \"name\")}"
            },
            {
              "age": "${map.get(__temp, \"age\")}"
            },
            {
              "address": "${map.get(__temp, \"address\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures object variables 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "person": {
                "name": "Bean",
                "hairColor": "white"
              }
            },
            {
              "name": "${map.get(person, \"name\")}"
            },
            {
              "hairColor": "${map.get(person, \"hairColor\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures objects in a nested property 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "name": "${map.get(data.person, \"name\")}"
            },
            {
              "age": "${map.get(data.person, \"age\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures objects in a non-pure nested property 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getData().person}"
            },
            {
              "name": "${map.get(__temp, \"name\")}"
            },
            {
              "age": "${map.get(__temp, \"age\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures deep objects 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getPerson()}"
            },
            {
              "name": "${map.get(__temp, \"name\")}"
            },
            {
              "countryName": "${map.get(__temp.address.country, \"name\")}"
            },
            {
              "code": "${map.get(__temp.address.country, \"code\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures object from call_step() 1'] = {
  "main": {
    "steps": [
      {
        "call_test_object_1": {
          "call": "test_object",
          "args": {
            "id": 1
          },
          "result": "__temp"
        }
      },
      {
        "assign1": {
          "assign": [
            {
              "name": "${map.get(__temp, \"name\")}"
            }
          ]
        }
      }
    ]
  },
  "test_object": {
    "params": [
      "id"
    ],
    "steps": [
      {
        "return1": {
          "return": {
            "name": "Bean"
          }
        }
      }
    ]
  }
}

exports['Destructing destructures objects with assigned variables 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getPerson()}"
            },
            {
              "myName": "${map.get(__temp, \"name\")}"
            },
            {
              "myCity": "${map.get(__temp.address, \"city\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing destructures objects in arrays 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getPersons()}"
            },
            {
              "__temp_len": "${len(__temp)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "name1": "${map.get(__temp[0], \"name\")}"
                      },
                      {
                        "age1": "${map.get(__temp[0], \"age\")}"
                      },
                      {
                        "name2": "${map.get(__temp[1], \"name\")}"
                      },
                      {
                        "age2": "${map.get(__temp[1], \"age\")}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "name1": "${map.get(__temp[0], \"name\")}"
                      },
                      {
                        "age1": "${map.get(__temp[0], \"age\")}"
                      },
                      {
                        "name2": null
                      },
                      {
                        "age2": null
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
                  "assign4": {
                    "assign": [
                      {
                        "name1": null
                      },
                      {
                        "age1": null
                      },
                      {
                        "name2": null
                      },
                      {
                        "age2": null
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

exports['Destructing destructures arrays in objects 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${getPerson()}"
            },
            {
              "__temp_len": "${len(__temp.names)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 3}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "first": "${__temp.names[0]}"
                      },
                      {
                        "middle": "${__temp.names[1]}"
                      },
                      {
                        "last": "${__temp.names[2]}"
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 2}",
              "steps": [
                {
                  "assign3": {
                    "assign": [
                      {
                        "first": "${__temp.names[0]}"
                      },
                      {
                        "middle": "${__temp.names[1]}"
                      },
                      {
                        "last": null
                      }
                    ]
                  }
                }
              ]
            },
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign4": {
                    "assign": [
                      {
                        "first": "${__temp.names[0]}"
                      },
                      {
                        "middle": null
                      },
                      {
                        "last": null
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
                  "assign5": {
                    "assign": [
                      {
                        "first": null
                      },
                      {
                        "middle": null
                      },
                      {
                        "last": null
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
        "assign6": {
          "assign": [
            {
              "__temp_len": "${len(__temp.professions)}"
            }
          ]
        }
      },
      {
        "switch2": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign7": {
                    "assign": [
                      {
                        "firstProfession": "${__temp.professions[0]}"
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
                  "assign8": {
                    "assign": [
                      {
                        "firstProfession": null
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

exports['Destructing destructures arrays in nested objects 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(data)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "__temp_len": "${len(data[0].values)}"
                      }
                    ]
                  }
                },
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${__temp_len >= 2}",
                        "steps": [
                          {
                            "assign3": {
                              "assign": [
                                {
                                  "a": "${data[0].values[0]}"
                                },
                                {
                                  "b": "${data[0].values[1]}"
                                }
                              ]
                            }
                          }
                        ]
                      },
                      {
                        "condition": "${__temp_len >= 1}",
                        "steps": [
                          {
                            "assign4": {
                              "assign": [
                                {
                                  "a": "${data[0].values[0]}"
                                },
                                {
                                  "b": null
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
                            "assign5": {
                              "assign": [
                                {
                                  "a": null
                                },
                                {
                                  "b": null
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
            },
            {
              "condition": true,
              "steps": [
                {
                  "assign6": {
                    "assign": [
                      {
                        "a": null
                      },
                      {
                        "b": null
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

exports['Destructing destructures a mixture of arrays and objects 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp_len": "${len(data.persons)}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "streetAddress": "${map.get(data.persons[0].address, \"street\")}"
                      },
                      {
                        "city": "${map.get(data.persons[0].address, \"city\")}"
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
                  "assign3": {
                    "assign": [
                      {
                        "streetAddress": null
                      },
                      {
                        "city": null
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
        "assign4": {
          "assign": [
            {
              "timestamp": "${map.get(data, \"timestamp\")}"
            },
            {
              "sourceDb": "${map.get(data.source, \"database\")}"
            },
            {
              "__temp_len": "${len(data.source.references)}"
            }
          ]
        }
      },
      {
        "switch2": {
          "switch": [
            {
              "condition": "${__temp_len >= 1}",
              "steps": [
                {
                  "assign5": {
                    "assign": [
                      {
                        "ref": "${data.source.references[0]}"
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
                  "assign6": {
                    "assign": [
                      {
                        "ref": null
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

exports['Destructing destructures objects in an assignment expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "data": {
                "value": 5
              }
            },
            {
              "value": 0
            },
            {
              "value": "${map.get(data, \"value\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing empty object pattern 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "data": {
                "name": "Bean"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing default values in object destructuring 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "name": "${map.get(data, \"name\")}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${\"parameters\" in data}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "parameters": "${data.parameters}"
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
                  "assign3": {
                    "assign": [
                      {
                        "parameters": {
                          "type": "simple"
                        }
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
        "assign4": {
          "assign": [
            {
              "timestamp": "${map.get(data, \"timestamp\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing rest element in object destructuring 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "name": "${map.get(data, \"name\")}"
            },
            {
              "code": "${map.get(data.country, \"code\")}"
            },
            {
              "other": "${map.delete(map.delete(data, \"name\"), \"country\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing rest element in a nested object in object destructuring 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "name": "${map.get(data, \"name\")}"
            },
            {
              "code": "${map.get(data.country, \"code\")}"
            },
            {
              "otherCountryProperties": "${map.delete(data.country, \"code\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Destructing rest element as the only pattern in object destructuring 1'] = {
  "main": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "properties": "${data}"
            }
          ]
        }
      }
    ]
  }
}
