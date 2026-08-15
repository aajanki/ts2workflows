exports['Function invocation statement assignment of a function call result 1'] = {
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

exports['Function invocation statement assignment of a function call result with anonymous parameters 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "three": "${add(1, 2)}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement assignment of a scoped function call result 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "projectId": "${sys.get_env(\"GOOGLE_CLOUD_PROJECT_ID\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement side effecting function call 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${writeLog(\"Everything going OK!\")}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement transpiles blocking functions as call steps 1'] = {
  "main": {
    "steps": [
      {
        "call_sys_log_1": {
          "call": "sys.log",
          "args": {
            "severity": "ERROR",
            "text": "Something bad happened"
          }
        }
      }
    ]
  }
}

exports['Function invocation statement assigns the return value of a blocking function call (variable declaration) 1'] = {
  "main": {
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
  }
}

exports['Function invocation statement assigns the return value of a blocking function call (assignment) 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "response": null
            }
          ]
        }
      },
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://visit.dreamland.test/"
          },
          "result": "__temp0"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "response": "${__temp0}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement a blocking function call and a map literal in the same expression 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "values": [
                  1,
                  2
                ]
              }
            }
          ]
        }
      },
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://visit.dreamland.test/"
          },
          "result": "__temp1"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "response": "${combine(__temp1, __temp0.values[0])}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement assigns the return value of a blocking function call to a complex variable 1'] = {
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
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://visit.dreamland.test/"
          },
          "result": "__temp0"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "results.response": "${__temp0}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement creates call steps for blocking calls in a condition 1'] = {
  "check_post_result": {
    "steps": [
      {
        "call_http_post_1": {
          "call": "http.post",
          "args": {
            "url": "https://visit.dreamland.test/"
          },
          "result": "__temp0"
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${__temp0.code == 200}",
              "steps": [
                {
                  "return1": {
                    "return": "ok"
                  }
                }
              ]
            },
            {
              "condition": true,
              "steps": [
                {
                  "return2": {
                    "return": "error"
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

exports['Function invocation statement creates call steps for blocking calls in a nested scopes 1'] = {
  "scopes": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "result": {}
            }
          ]
        }
      },
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://visit.dreamland.test/outer.html"
          },
          "result": "__temp0"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "result.outer": "${__temp0}"
            }
          ]
        }
      },
      {
        "switch1": {
          "switch": [
            {
              "condition": "${result.outer.code == 200}",
              "steps": [
                {
                  "try1": {
                    "try": {
                      "steps": [
                        {
                          "call_http_get_2": {
                            "call": "http.get",
                            "args": {
                              "url": "https://visit.dreamland.test/inner.html"
                            },
                            "result": "__temp0"
                          }
                        },
                        {
                          "return1": {
                            "return": "${__temp0}"
                          }
                        }
                      ]
                    },
                    "except": {
                      "as": "e",
                      "steps": [
                        {
                          "return2": {
                            "return": "exception"
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
                  "return3": {
                    "return": "error"
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

exports['Function invocation statement creates call steps for blocking calls in for loops 1'] = {
  "check_post_result": {
    "steps": [
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
                "call_http_get_1": {
                  "call": "http.get",
                  "args": {
                    "url": "${\"https://visit.dreamland.test/page-\" + default(i, \"null\") + \".html\"}"
                  },
                  "result": "res"
                }
              }
            ]
          }
        }
      }
    ]
  }
}

exports['Function invocation statement creates call steps for blocking calls in return expressions 1'] = {
  "download": {
    "steps": [
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://visit.dreamland.test/"
          },
          "result": "__temp0"
        }
      },
      {
        "return1": {
          "return": "${__temp0}"
        }
      }
    ]
  }
}

exports['Function invocation statement creates call steps for blocking calls in complex expressions 1'] = {
  "location": {
    "steps": [
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://visit.dreamland.test/elfo.html"
          },
          "result": "__temp0"
        }
      },
      {
        "call_http_get_2": {
          "call": "http.get",
          "args": {
            "url": "https://visit.dreamland.test/luci.html"
          },
          "result": "__temp1"
        }
      },
      {
        "return1": {
          "return": "${\"response:\" + map.get(__temp0, \"body\") + __temp1.body}"
        }
      }
    ]
  }
}

exports['Function invocation statement generates assign and call steps in correct order in expressions 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "url": "https://visit.dreamland.test/elfo.html"
            }
          ]
        }
      },
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "${url}"
          },
          "result": "__temp0"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "message": "${\"response:\" + __temp0.body}"
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${message}"
        }
      }
    ]
  }
}

exports['Function invocation statement regression: parameter assignments and blocking call in correct order when the call result is type cast 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "parent": "projects/test/databases/(default)/documents"
            },
            {
              "collectionId": "chatrooms"
            }
          ]
        }
      },
      {
        "call_googleapis_firestore_v1_projects_databases_documents_list_1": {
          "call": "googleapis.firestore.v1.projects.databases.documents.list",
          "args": {
            "collectionId": "${collectionId}",
            "parent": "${parent}"
          },
          "result": "__temp0"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "result": "${__temp0}"
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
  }
}

exports['Function invocation statement does not output undefined arguments in blocking calls 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "docname": "projects/test/databases/(default)/documents/tvshows/disenchantment"
            }
          ]
        }
      },
      {
        "call_googleapis_firestore_v1_projects_databases_documents_patch_1": {
          "call": "googleapis.firestore.v1.projects.databases.documents.patch",
          "args": {
            "name": "${docname}",
            "updateMask": {
              "fieldPaths": [
                "rating"
              ]
            },
            "body": {
              "fields": {
                "rating": {
                  "doubleValue": 9
                }
              }
            }
          },
          "result": "updated"
        }
      },
      {
        "return1": {
          "return": "${updated}"
        }
      }
    ]
  }
}

exports['Function invocation statement does not output undefined arguments in blocking calls in expressions 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "docname": "projects/test/databases/(default)/documents/tvshows/disenchantment"
            },
            {
              "__temp0": {
                "fieldPaths": [
                  "rating"
                ]
              }
            },
            {
              "__temp1": {
                "fields": {
                  "rating": {
                    "doubleValue": 9
                  }
                }
              }
            }
          ]
        }
      },
      {
        "call_googleapis_firestore_v1_projects_databases_documents_patch_1": {
          "call": "googleapis.firestore.v1.projects.databases.documents.patch",
          "args": {
            "name": "${docname}",
            "updateMask": "${__temp0}",
            "body": "${__temp1}"
          },
          "result": "__temp2"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "updated": "${__temp2.updateTime}"
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${updated}"
        }
      }
    ]
  }
}

exports['Function invocation statement creates call steps for nested blocking calls 1'] = {
  "nested": {
    "steps": [
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://example.com/redirected.json"
          },
          "result": "__temp0"
        }
      },
      {
        "call_http_get_2": {
          "call": "http.get",
          "args": {
            "url": "${__temp0.body}"
          },
          "result": "__temp1"
        }
      },
      {
        "call_http_get_3": {
          "call": "http.get",
          "args": {
            "url": "${__temp1.body}"
          },
          "result": "__temp2"
        }
      },
      {
        "return1": {
          "return": "${__temp2}"
        }
      }
    ]
  }
}

exports['Function invocation statement creates call steps for a nested blocking nested in non-blocking calls 1'] = {
  "nested": {
    "steps": [
      {
        "call_http_get_1": {
          "call": "http.get",
          "args": {
            "url": "https://example.com/redirected.json"
          },
          "result": "__temp0"
        }
      },
      {
        "return1": {
          "return": "${map.get(map.get(__temp0, \"body\"), \"value\")}"
        }
      }
    ]
  }
}

exports['Function invocation statement ignores extra arguments in a blocking function call 1'] = {
  "main": {
    "steps": [
      {
        "call_sys_sleep_1": {
          "call": "sys.sleep",
          "args": {
            "seconds": 1000
          }
        }
      }
    ]
  }
}

exports['Function invocation statement ignores extra arguments in a blocking function call in a nested expression 1'] = {
  "main": {
    "params": [
      "callbackobj"
    ],
    "steps": [
      {
        "call_events_await_callback_1": {
          "call": "events.await_callback",
          "args": {
            "callback": "${callbackobj}",
            "timeout": 1000
          },
          "result": "__temp0"
        }
      },
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${handle(__temp0)}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement call_step() outputs a call step 1'] = {
  "main": {
    "steps": [
      {
        "call_sys_log_1": {
          "call": "sys.log",
          "args": {
            "json": {
              "message": "Meow. That's what cats say, right?"
            },
            "severity": "DEBUG"
          }
        }
      }
    ]
  }
}

exports['Function invocation statement call_step() outputs a call step 2 1'] = {
  "main": {
    "steps": [
      {
        "call_sys_log_1": {
          "call": "sys.log",
          "args": {
            "json": {
              "data": {
                "name": "Oona",
                "occupations": [
                  "queen",
                  "pirate"
                ]
              }
            },
            "severity": "INFO"
          }
        }
      }
    ]
  }
}

exports['Function invocation statement call_step() with a return value 1'] = {
  "main": {
    "steps": [
      {
        "call_http_post_1": {
          "call": "http.post",
          "args": {
            "url": "https://visit.dreamland.test/",
            "body": {
              "user": "bean"
            }
          },
          "result": "response"
        }
      }
    ]
  }
}

exports['Function invocation statement call_step() with a return value assigned to a member variable 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "data": {}
            }
          ]
        }
      },
      {
        "call_http_post_1": {
          "call": "http.post",
          "args": {
            "url": "https://visit.dreamland.test/",
            "body": {
              "user": "bean"
            }
          },
          "result": "__temp"
        }
      },
      {
        "assign2": {
          "assign": [
            {
              "data.response": "${__temp}"
            }
          ]
        }
      }
    ]
  }
}

exports['Function invocation statement call_step() without function arguments 1'] = {
  "main": {
    "steps": [
      {
        "call_sys_now_1": {
          "call": "sys.now",
          "result": "timestamp"
        }
      }
    ]
  }
}
