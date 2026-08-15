exports['Literals parses maps with identifier as keys 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": {
                "name": "Merkimer",
                "race": "pig"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Literals parses maps with special characters in keys 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": {
                "special!": 1,
                "'quotes\"in keys": 2,
                "...": 3
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Literals parses maps with numbers as keys 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "x": {
                "42": "answer"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Expressions and operators parses expressions as map values 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "_": {
                "name": "${name}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Expressions and operators parses expressions as map values 2 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "_": {
                "age": "${thisYear - birthYear}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Expressions and operators parses expressions as map values 3 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "_": {
                "id": "${\"ID-\" + identifiers[2]}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Expressions and operators parses nested expression in map values 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "_": {
                "success": "${code in [200, 201]}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Expressions and operators parses nested expression in map values 2 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp0": {
                "Dreamland": 1,
                "Maru": 2
              }
            },
            {
              "_": {
                "isKnownLocation": "${location in __temp0}"
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Expressions and operators parses nested expression in map values 3 1'] = {
  "test": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "_": {
                "values": {
                  "next": "${a + 1}"
                }
              }
            }
          ]
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles optional chaining as map.get() 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(data, \"name\")}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles nested optional chains 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(data.person[3], [\"address\", \"city\", \"id\"])}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles optional chains with alternativing optional and non-optional elements 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(data, [\"person\", \"address\", \"city\", \"id\"])}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles (data?.a).b 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(data, \"a\").b}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles (data?.a)?.b 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(map.get(data, \"a\"), \"b\")}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles optional chaining with bracket notation 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(data, \"na\" + \"me\")}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles type alias in optional chaining 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(map.get(data, \"person\"), \"name\")}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles definite operator in optional chaining 1'] = {
  "test": {
    "params": [
      "data"
    ],
    "steps": [
      {
        "return1": {
          "return": "${map.get(data, [\"person\", \"name\"])}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles typeof 1'] = {
  "typeof2": {
    "params": [
      "x"
    ],
    "steps": [
      {
        "return1": {
          "return": "${text.replace_all_regex(text.replace_all_regex(get_type(x), \"^(bytes|list|map|null)$\", \"object\"), \"^(double|integer)$\", \"number\")}"
        }
      }
    ]
  }
}

exports['Expressions and operators transpiles void operator 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "__temp": "${sideEffect()}"
            }
          ]
        }
      }
    ]
  },
  "sideEffect": {
    "steps": [
      {
        "return1": {
          "return": 1
        }
      }
    ]
  }
}

exports['Expressions and operators ignores satisfies operator 1'] = {
  "main": {
    "steps": [
      {
        "assign1": {
          "assign": [
            {
              "light": {
                "color": "green"
              }
            }
          ]
        }
      },
      {
        "return1": {
          "return": "${light.color}"
        }
      }
    ]
  }
}
