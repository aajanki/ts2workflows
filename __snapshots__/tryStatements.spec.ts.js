exports['Try-catch-finally statement transpiles try-catch statement 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "except": {
            "as": "err",
            "steps": [
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${err.code == 404}",
                      "steps": [
                        {
                          "return2": {
                            "return": "Not found"
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
      }
    ]
  }
}

exports['Try-catch-finally statement transpiles try-catch without an error variable 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement empty try block 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": []
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement empty catch block 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "raise1": {
                  "raise": 1
                }
              }
            ]
          },
          "except": {
            "steps": []
          }
        }
      }
    ]
  }
}

exports['Try-catch-finally statement transpiles try-catch-finally statement 1'] = {
  "safeWrite": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__temp": "${writeData(data)}"
                            }
                          ]
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "err",
                    "steps": [
                      {
                        "call_sys_log_1": {
                          "call": "sys.log",
                          "args": {
                            "data": "${err}"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign3": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign4": {
          "assign": [
            {
              "__temp": "${closeConnection()}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return1": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles try-catch-finally statement with a return statement in the try block 1'] = {
  "safeWrite": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__temp": "${writeData(data)}"
                            }
                          ]
                        }
                      },
                      {
                        "assign3": {
                          "assign": [
                            {
                              "__t2w_finally_condition1": "return"
                            },
                            {
                              "__t2w_finally_value1": "OK"
                            }
                          ],
                          "next": "assign5"
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "err",
                    "steps": [
                      {
                        "call_sys_log_1": {
                          "call": "sys.log",
                          "args": {
                            "data": "${err}"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign4": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign5": {
          "assign": [
            {
              "__temp": "${closeConnection()}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return1": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles try-catch-finally statement with a return statement in the catch block 1'] = {
  "safeWrite": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__temp": "${writeData(data)}"
                            }
                          ]
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "err",
                    "steps": [
                      {
                        "call_sys_log_1": {
                          "call": "sys.log",
                          "args": {
                            "data": "${err}"
                          }
                        }
                      },
                      {
                        "assign3": {
                          "assign": [
                            {
                              "__t2w_finally_condition1": "return"
                            },
                            {
                              "__t2w_finally_value1": "Error!"
                            }
                          ],
                          "next": "assign5"
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign4": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign5": {
          "assign": [
            {
              "__temp": "${closeConnection()}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return1": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles try-catch-finally statement with a return statement in the finally block 1'] = {
  "safeWrite": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__temp": "${writeData(data)}"
                            }
                          ]
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "err",
                    "steps": [
                      {
                        "call_sys_log_1": {
                          "call": "sys.log",
                          "args": {
                            "data": "${err}"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign3": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign4": {
          "assign": [
            {
              "__temp": "${closeConnection()}"
            }
          ]
        }
      },
      {
        "return1": {
          "return": 0
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return2": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles try-catch with an empty finally block 1'] = {
  "safeWrite": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__temp": "${writeData(data)}"
                            }
                          ]
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "err",
                    "steps": [
                      {
                        "call_sys_log_1": {
                          "call": "sys.log",
                          "args": {
                            "data": "${err}"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign3": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return1": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles try-catch-retry 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "retry": "${http.default_retry}",
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement transpiles try-catch-retry-finally 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "call_http_get_1": {
                          "call": "http.get",
                          "args": {
                            "url": "https://visit.dreamland.test/"
                          },
                          "result": "response"
                        }
                      },
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__t2w_finally_condition1": "return"
                            },
                            {
                              "__t2w_finally_value1": "${response}"
                            }
                          ],
                          "next": "assign5"
                        }
                      }
                    ]
                  },
                  "retry": "${http.default_retry}",
                  "except": {
                    "steps": [
                      {
                        "assign3": {
                          "assign": [
                            {
                              "__temp": "${log(\"Error!\")}"
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
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign4": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign5": {
          "assign": [
            {
              "__temp": "${closeConnection()}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return1": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles try-finally without a catch block 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "call_http_get_1": {
                          "call": "http.get",
                          "args": {
                            "url": "https://visit.dreamland.test/"
                          },
                          "result": "response"
                        }
                      },
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__t2w_finally_condition1": "return"
                            },
                            {
                              "__t2w_finally_value1": "${response}"
                            }
                          ],
                          "next": "assign4"
                        }
                      }
                    ]
                  },
                  "retry": "${http.default_retry}"
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign3": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign4": {
          "assign": [
            {
              "__temp": "${closeConnection()}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return1": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles nested try statements with a finally block on the inner try 1'] = {
  "test": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": null
                    },
                    {
                      "__t2w_finally_value1": null
                    }
                  ]
                }
              },
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "try3": {
                          "try": {
                            "steps": [
                              {
                                "assign2": {
                                  "assign": [
                                    {
                                      "__t2w_finally_condition1": "return"
                                    },
                                    {
                                      "__t2w_finally_value1": 1
                                    }
                                  ],
                                  "next": "assign4"
                                }
                              }
                            ]
                          },
                          "except": {
                            "as": "err",
                            "steps": [
                              {
                                "call_sys_log_1": {
                                  "call": "sys.log",
                                  "args": {
                                    "data": "Error"
                                  }
                                }
                              }
                            ]
                          }
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "__fin_exc",
                    "steps": [
                      {
                        "assign3": {
                          "assign": [
                            {
                              "__t2w_finally_condition1": "raise"
                            },
                            {
                              "__t2w_finally_value1": "${__fin_exc}"
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              },
              {
                "assign4": {
                  "assign": [
                    {
                      "__temp": "${cleanup()}"
                    }
                  ]
                }
              },
              {
                "switch1": {
                  "switch": [
                    {
                      "condition": "${__t2w_finally_condition1 == \"return\"}",
                      "steps": [
                        {
                          "return1": {
                            "return": "${__t2w_finally_value1}"
                          }
                        }
                      ]
                    },
                    {
                      "condition": "${__t2w_finally_condition1 == \"raise\"}",
                      "steps": [
                        {
                          "raise1": {
                            "raise": "${__t2w_finally_value1}"
                          }
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "return2": {
                  "return": 2
                }
              }
            ]
          },
          "except": {
            "as": "err",
            "steps": [
              {
                "call_sys_log_2": {
                  "call": "sys.log",
                  "args": {
                    "data": "Error"
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

exports['Try-catch-finally statement transpiles nested try statements with a finally block on the outer try 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "try3": {
                          "try": {
                            "steps": [
                              {
                                "assign2": {
                                  "assign": [
                                    {
                                      "__t2w_finally_condition1": "return"
                                    },
                                    {
                                      "__t2w_finally_value1": 1
                                    }
                                  ],
                                  "next": "assign5"
                                }
                              }
                            ]
                          },
                          "except": {
                            "as": "err",
                            "steps": [
                              {
                                "call_sys_log_1": {
                                  "call": "sys.log",
                                  "args": {
                                    "data": "Error"
                                  }
                                }
                              }
                            ]
                          }
                        }
                      },
                      {
                        "assign3": {
                          "assign": [
                            {
                              "__t2w_finally_condition1": "return"
                            },
                            {
                              "__t2w_finally_value1": 2
                            }
                          ],
                          "next": "assign5"
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "err",
                    "steps": [
                      {
                        "call_sys_log_2": {
                          "call": "sys.log",
                          "args": {
                            "data": "Error"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign4": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign5": {
          "assign": [
            {
              "__temp": "${cleanup()}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return1": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise1": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement transpiles nested try statements with finally blocks on all tries 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__t2w_finally_condition1": null
            },
            {
              "__t2w_finally_value1": null
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "try2": {
                  "try": {
                    "steps": [
                      {
                        "assign2": {
                          "assign": [
                            {
                              "__t2w_finally_condition2": null
                            },
                            {
                              "__t2w_finally_value2": null
                            }
                          ]
                        }
                      },
                      {
                        "try3": {
                          "try": {
                            "steps": [
                              {
                                "try4": {
                                  "try": {
                                    "steps": [
                                      {
                                        "assign3": {
                                          "assign": [
                                            {
                                              "__t2w_finally_condition2": "return"
                                            },
                                            {
                                              "__t2w_finally_value2": 1
                                            }
                                          ],
                                          "next": "assign5"
                                        }
                                      }
                                    ]
                                  },
                                  "except": {
                                    "as": "err",
                                    "steps": [
                                      {
                                        "call_sys_log_1": {
                                          "call": "sys.log",
                                          "args": {
                                            "data": "Error"
                                          }
                                        }
                                      }
                                    ]
                                  }
                                }
                              }
                            ]
                          },
                          "except": {
                            "as": "__fin_exc",
                            "steps": [
                              {
                                "assign4": {
                                  "assign": [
                                    {
                                      "__t2w_finally_condition2": "raise"
                                    },
                                    {
                                      "__t2w_finally_value2": "${__fin_exc}"
                                    }
                                  ]
                                }
                              }
                            ]
                          }
                        }
                      },
                      {
                        "assign5": {
                          "assign": [
                            {
                              "__temp": "${cleanup1()}"
                            }
                          ]
                        }
                      },
                      {
                        "switch1": {
                          "switch": [
                            {
                              "condition": "${__t2w_finally_condition2 == \"return\"}",
                              "steps": [
                                {
                                  "return1": {
                                    "return": "${__t2w_finally_value2}"
                                  }
                                }
                              ]
                            },
                            {
                              "condition": "${__t2w_finally_condition2 == \"raise\"}",
                              "steps": [
                                {
                                  "raise1": {
                                    "raise": "${__t2w_finally_value2}"
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
                              "__t2w_finally_condition1": "return"
                            },
                            {
                              "__t2w_finally_value1": 2
                            }
                          ],
                          "next": "assign8"
                        }
                      }
                    ]
                  },
                  "except": {
                    "as": "err",
                    "steps": [
                      {
                        "call_sys_log_2": {
                          "call": "sys.log",
                          "args": {
                            "data": "Error"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          "except": {
            "as": "__fin_exc",
            "steps": [
              {
                "assign7": {
                  "assign": [
                    {
                      "__t2w_finally_condition1": "raise"
                    },
                    {
                      "__t2w_finally_value1": "${__fin_exc}"
                    }
                  ]
                }
              }
            ]
          }
        }
      },
      {
        "assign8": {
          "assign": [
            {
              "__temp": "${cleanup2()}"
            }
          ]
        }
      },
      {
        "switch2": {
          "switch": [
            {
              "condition": "${__t2w_finally_condition1 == \"return\"}",
              "steps": [
                {
                  "return2": {
                    "return": "${__t2w_finally_value1}"
                  }
                }
              ]
            },
            {
              "condition": "${__t2w_finally_condition1 == \"raise\"}",
              "steps": [
                {
                  "raise2": {
                    "raise": "${__t2w_finally_value1}"
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

exports['Try-catch-finally statement does retry with a retry predicate and backoff parameters 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "retry": {
            "predicate": "${http.default_retry_predicate}",
            "max_retries": 3,
            "backoff": {
              "initial_delay": 0.5,
              "max_delay": 60,
              "multiplier": 2.5
            }
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement retries with a custom predicate 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "retry": {
            "predicate": "${custom_predicate}",
            "max_retries": 3,
            "backoff": {
              "initial_delay": 0.5,
              "max_delay": 60,
              "multiplier": 2.5
            }
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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
  "custom_predicate": {
    "params": [
      "e"
    ],
    "steps": [
      {
        "return1": {
          "return": false
        }
      }
    ]
  }
}

exports['Try-catch-finally statement retry policy with string values 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "retry": {
            "predicate": "${http.default_retry_predicate}",
            "max_retries": "5",
            "backoff": {
              "initial_delay": "5",
              "max_delay": "60",
              "multiplier": "2"
            }
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement retry policy with expressions 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "multiplier": 2
            }
          ]
        }
      },
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "retry": {
            "predicate": "${http.default_retry_predicate}",
            "max_retries": "${sys.get_env(\"MAX_RETRIES\")}",
            "backoff": {
              "initial_delay": 0.5,
              "max_delay": 60,
              "multiplier": "${multiplier}"
            }
          },
          "except": {
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement accepts partial custom retry predicate specifications 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "retry": {
            "predicate": "${http.default_retry_predicate}",
            "max_retries": 3,
            "backoff": {
              "max_delay": 60
            }
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement accepts partial custom retry predicate specifications 2 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "return1": {
                  "return": "${response}"
                }
              }
            ]
          },
          "retry": {
            "max_retries": 3,
            "backoff": {
              "initial_delay": 0.5,
              "max_delay": 60,
              "multiplier": 3
            }
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement applies retry policy only on one try on nested try blocks 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "try2": {
                  "try": {
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
                  },
                  "except": {
                    "as": "e",
                    "steps": []
                  }
                }
              }
            ]
          },
          "retry": "${http.default_retry}",
          "except": {
            "as": "e",
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement applies separate retry policies on nested try blocks 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              },
              {
                "try2": {
                  "try": {
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
                  },
                  "retry": "${custom_retry}",
                  "except": {
                    "as": "e",
                    "steps": []
                  }
                }
              }
            ]
          },
          "retry": "${http.default_retry}",
          "except": {
            "as": "e",
            "steps": [
              {
                "assign2": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement ignores retry_policy() outside of try block 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              }
            ]
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement ignores retry_policy() in catch block 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
            "steps": [
              {
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "https://visit.dreamland.test/"
                  },
                  "result": "response"
                }
              }
            ]
          },
          "except": {
            "steps": [
              {
                "assign1": {
                  "assign": [
                    {
                      "__temp": "${log(\"Error!\")}"
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

exports['Try-catch-finally statement transpiles break inside try without a finalizer 1'] = {
  "main": {
    "steps": [
      {
        "try1": {
          "try": {
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
                    "value": "i",
                    "in": [
                      1,
                      2,
                      3
                    ],
                    "steps": [
                      {
                        "switch1": {
                          "switch": [
                            {
                              "condition": "${i % 2 == 0}",
                              "next": "break"
                            }
                          ]
                        }
                      },
                      {
                        "assign2": {
                          "assign": [
                            {
                              "total": "${total + i}"
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
          },
          "except": {
            "as": "err",
            "steps": [
              {
                "call_sys_log_1": {
                  "call": "sys.log",
                  "args": {
                    "data": "${err}"
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

exports['Throw statement transpiles a throw with a literal string value 1'] = {
  "main": {
    "steps": [
      {
        "raise1": {
          "raise": "Error!"
        }
      }
    ]
  }
}

exports['Throw statement transpiles a throw with a literal map value 1'] = {
  "main": {
    "steps": [
      {
        "raise1": {
          "raise": {
            "code": 98,
            "message": "Access denied"
          }
        }
      }
    ]
  }
}

exports['Throw statement transpiles a throw with a map value that includes a variable reference 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "errorCode": 98
            }
          ]
        }
      },
      {
        "raise1": {
          "raise": {
            "code": "${errorCode}",
            "message": "Access denied"
          }
        }
      }
    ]
  }
}

exports['Throw statement transpiles a throw with an expression 1'] = {
  "main": {
    "params": [
      "exception"
    ],
    "steps": [
      {
        "raise1": {
          "raise": "${exception}"
        }
      }
    ]
  }
}
