exports['Loops transpiles a for loop 1'] = {
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
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3
            ],
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops transpiles a for loop with identifier as the for loop variable 1'] = {
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
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3
            ],
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops transpiles a for loop with a let for loop variable 1'] = {
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
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3
            ],
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops transpiles a for loop with an empty body 1'] = {
  "main": {
    "steps": [
      {
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3
            ],
            "steps": []
          }
        }
      }
    ]
  }
}

exports['Loops transpiles a for loop over map keys 1'] = {
  "main": {
    "params": [
      "my_map"
    ],
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
        "for1": {
          "for": {
            "value": "key",
            "in": "${keys(my_map)}",
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + my_map[key]}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops transpiles a continue in a for loop body 1'] = {
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
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3,
              4
            ],
            "steps": [
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${x % 2 == 0}",
                      "next": "continue"
                    }
                  ]
                }
              },
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops accepts a continue with a label 1'] = {
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
        "loop": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3,
              4
            ],
            "steps": [
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${x % 2 == 0}",
                      "next": "loop"
                    }
                  ]
                }
              },
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops transpiles a break in a for loop body 1'] = {
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
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3,
              4
            ],
            "steps": [
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${total > 5}",
                      "next": "break"
                    }
                  ]
                }
              },
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops accepts a break with a label 1'] = {
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
        "loop": {
          "for": {
            "value": "x",
            "in": [
              1,
              2,
              3,
              4
            ],
            "steps": [
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${total > 5}",
                      "next": "loop"
                    }
                  ]
                }
              },
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops transpiles a for loop of a list expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "total": 0
            },
            {
              "values": [
                1,
                2,
                3
              ]
            }
          ]
        }
      },
      {
        "for1": {
          "for": {
            "value": "x",
            "in": "${values}",
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "total": "${total + x}"
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
          "return": "${total}"
        }
      }
    ]
  }
}

exports['Loops transpiles nested for loops with continue on the outer loop 1'] = {
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
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2
            ],
            "steps": [
              {
                "for2": {
                  "for": {
                    "value": "y",
                    "in": [
                      3,
                      4
                    ],
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "total": "${total + y}"
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              },
              {
                "next1": {
                  "next": "continue"
                }
              }
            ]
          }
        }
      }
    ]
  }
}

exports['Loops transpiles nested for loops with continue on the inner loop 1'] = {
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
        "for1": {
          "for": {
            "value": "x",
            "in": [
              1,
              2
            ],
            "steps": [
              {
                "for2": {
                  "for": {
                    "value": "y",
                    "in": [
                      3,
                      4
                    ],
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "total": "${total + y}"
                            }
                          ],
                          "next": "continue"
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }
}

exports['Loops transpiles a while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "i": 5
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${i > 0}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "i": "${i - 1}"
                      }
                    ],
                    "next": "switch1"
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

exports['Loops transpiles a while loop with a single-statement body 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "i": 5
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${i > 0}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "i": "${i - 1}"
                      }
                    ],
                    "next": "switch1"
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

exports['Loops transpiles a break in a while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0.11
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x >= 0}",
              "steps": [
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${x > 0.9}",
                        "next": "return1"
                      }
                    ]
                  }
                },
                {
                  "switch3": {
                    "switch": [
                      {
                        "condition": "${x < 0.5}",
                        "steps": [
                          {
                            "assign2": {
                              "assign": [
                                {
                                  "x": "${x * 2}"
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
                                  "x": "${2 * (1 - x)}"
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
                  "next2": {
                    "next": "switch1"
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

exports['Loops transpiles a break and a while loop as the last statement in a block 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0.11
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x >= 0}",
              "steps": [
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${x > 0.9}",
                        "next": "end"
                      }
                    ]
                  }
                },
                {
                  "switch3": {
                    "switch": [
                      {
                        "condition": "${x < 0.5}",
                        "steps": [
                          {
                            "assign2": {
                              "assign": [
                                {
                                  "x": "${x * 2}"
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
                                  "x": "${2 * (1 - x)}"
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
                  "next2": {
                    "next": "switch1"
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

exports['Loops transpiles a continue in a while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0.11
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x < 0.9}",
              "steps": [
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${x < 0.5}",
                        "steps": [
                          {
                            "assign2": {
                              "assign": [
                                {
                                  "x": "${x * 2}"
                                }
                              ],
                              "next": "switch1"
                            }
                          }
                        ]
                      }
                    ]
                  }
                },
                {
                  "assign3": {
                    "assign": [
                      {
                        "x": "${2 * (1 - x)}"
                      }
                    ],
                    "next": "switch1"
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

exports['Loops transpiles a do...while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "i": 5
            }
          ]
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "i": "${i - 1}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${i > 0}",
              "next": "assign2"
            }
          ]
        }
      }
    ]
  }
}

exports['Loops transpiles a break in a do...while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0.11
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x > 0.9}",
              "next": "return1"
            }
          ]
        }
      },
      {
        "switch2": {
          "switch": [
            {
              "condition": "${x < 0.5}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "x": "${x * 2}"
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
                        "x": "${2 * (1 - x)}"
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
        "switch3": {
          "switch": [
            {
              "condition": "${x >= 0}",
              "next": "switch1"
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

exports['Loops transpiles a break and a do...while loop as the last statement in a block 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0.11
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x > 0.9}",
              "next": "end"
            }
          ]
        }
      },
      {
        "switch2": {
          "switch": [
            {
              "condition": "${x < 0.5}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "x": "${x * 2}"
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
                        "x": "${2 * (1 - x)}"
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
        "switch3": {
          "switch": [
            {
              "condition": "${x >= 0}",
              "next": "switch1"
            }
          ]
        }
      }
    ]
  }
}

exports['Loops transpiles a break in a do...while loop nested in try statement 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0.11
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
                      "condition": "${x > 0.9}",
                      "next": "return1"
                    }
                  ]
                }
              },
              {
                "switch2": {
                  "switch": [
                    {
                      "condition": "${x < 0.5}",
                      "steps": [
                        {
                          "assign2": {
                            "assign": [
                              {
                                "x": "${x * 2}"
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
                                "x": "${2 * (1 - x)}"
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
                "switch3": {
                  "switch": [
                    {
                      "condition": "${x >= 0}",
                      "next": "switch1"
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
                "assign4": {
                  "assign": [
                    {
                      "x": -1
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
          "return": "${x}"
        }
      }
    ]
  }
}

exports['Loops transpiles a continue in a do...while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0.11
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x < 0.5}",
              "steps": [
                {
                  "assign2": {
                    "assign": [
                      {
                        "x": "${x * 2}"
                      }
                    ],
                    "next": "switch1"
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "assign3": {
          "assign": [
            {
              "x": "${2 * (1 - x)}"
            }
          ]
        }
      },
      {
        "switch2": {
          "switch": [
            {
              "condition": "${x < 0.9}",
              "next": "switch1"
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

exports['Loops transpiles nested while loops with continue on the outer loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x < 5}",
              "steps": [
                {
                  "next1": {
                    "next": "switch1"
                  }
                },
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${x < 5}",
                        "steps": [
                          {
                            "assign2": {
                              "assign": [
                                {
                                  "x": "${x + 1}"
                                }
                              ],
                              "next": "switch2"
                            }
                          }
                        ]
                      }
                    ]
                  }
                },
                {
                  "next2": {
                    "next": "switch1"
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

exports['Loops transpiles nested while loops with continue on the inner loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x < 5}",
              "steps": [
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${x < 5}",
                        "steps": [
                          {
                            "next1": {
                              "next": "switch2"
                            }
                          },
                          {
                            "assign2": {
                              "assign": [
                                {
                                  "x": "${x + 1}"
                                }
                              ],
                              "next": "switch2"
                            }
                          }
                        ]
                      }
                    ]
                  }
                },
                {
                  "next2": {
                    "next": "switch1"
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

exports['Loops transpiles nested while loops with continue on all levels 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x < 5}",
              "steps": [
                {
                  "next1": {
                    "next": "switch1"
                  }
                },
                {
                  "switch2": {
                    "switch": [
                      {
                        "condition": "${x < 5}",
                        "steps": [
                          {
                            "next2": {
                              "next": "switch2"
                            }
                          },
                          {
                            "assign2": {
                              "assign": [
                                {
                                  "x": "${x + 1}"
                                }
                              ],
                              "next": "switch2"
                            }
                          }
                        ]
                      }
                    ]
                  }
                },
                {
                  "next3": {
                    "next": "switch1"
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

exports['Loops transpiles a continue in a for loop nested in a while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x < 5}",
              "steps": [
                {
                  "for1": {
                    "for": {
                      "value": "y",
                      "in": [
                        1,
                        2
                      ],
                      "steps": [
                        {
                          "switch2": {
                            "switch": [
                              {
                                "condition": "${y % 2 == 0}",
                                "next": "continue"
                              },
                              {
                                "condition": true,
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
                        }
                      ]
                    }
                  }
                },
                {
                  "next2": {
                    "next": "switch1"
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

exports['Loops transpiles a break in a for loop nested in a while loop 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": 0
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${x < 5}",
              "steps": [
                {
                  "for1": {
                    "for": {
                      "value": "y",
                      "in": [
                        1,
                        2
                      ],
                      "steps": [
                        {
                          "switch2": {
                            "switch": [
                              {
                                "condition": "${y % 2 == 0}",
                                "next": "break"
                              },
                              {
                                "condition": true,
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
                        }
                      ]
                    }
                  }
                },
                {
                  "next2": {
                    "next": "switch1"
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
