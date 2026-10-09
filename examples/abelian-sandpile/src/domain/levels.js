(function(root){
  'use strict';
  const levels = [
  {
    "id": "intro-cross",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "一粒沙的十字",
    "description": "中心已有 3 粒。再加一粒，会发生什么？",
    "board": {
      "width": 3,
      "height": 3,
      "initial": [
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        1,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 1,
        "y": 1
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 1,
    "referenceMoves": [
      {
        "x": 1,
        "y": 1
      }
    ],
    "teaching": {
      "tier": "intro",
      "concept": "阈值与四向分配",
      "hints": [
        "先比较初态与目标，注意“阈值与四向分配”。每步只加一粒，未稳定时不能继续。",
        "中心再加一粒即可达到四。",
        "落点分配：(1,1) 投 1 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "chain",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "连锁反应",
    "description": "中心崩塌会让上方的 3 粒也达到阈值。",
    "board": {
      "width": 3,
      "height": 3,
      "initial": [
        0,
        3,
        0,
        0,
        3,
        0,
        0,
        0,
        0
      ],
      "target": [
        1,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 1,
        "y": 1
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 1,
    "referenceMoves": [
      {
        "x": 1,
        "y": 1
      }
    ],
    "teaching": {
      "tier": "intro",
      "concept": "新触发留到下一波",
      "hints": [
        "先比较初态与目标，注意“新触发留到下一波”。每步只加一粒，未稳定时不能继续。",
        "先看中心，再看中心上方原有三粒。",
        "落点分配：(1,1) 投 1 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "corner",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "角落的沙",
    "description": "角格仍需 4 粒才崩塌，其中两粒会流出棋盘。",
    "board": {
      "width": 3,
      "height": 3,
      "initial": [
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 0,
        "y": 0
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 1,
    "referenceMoves": [
      {
        "x": 0,
        "y": 0
      }
    ],
    "teaching": {
      "tier": "intro",
      "concept": "角落有两个耗散方向",
      "hints": [
        "先比较初态与目标，注意“角落有两个耗散方向”。每步只加一粒，未稳定时不能继续。",
        "角落两条方向在棋盘外。",
        "落点分配：(0,0) 投 1 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "edge",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "边缘传播",
    "description": "在边缘触发崩塌，观察一粒流失和三个内邻格。",
    "board": {
      "width": 3,
      "height": 3,
      "initial": [
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "target": [
        1,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 1,
        "y": 0
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 1,
    "referenceMoves": [
      {
        "x": 1,
        "y": 0
      }
    ],
    "teaching": {
      "tier": "intro",
      "concept": "边缘仍用阈值四",
      "hints": [
        "先比较初态与目标，注意“边缘仍用阈值四”。每步只加一粒，未稳定时不能继续。",
        "上边中格的上方是耗散汇。",
        "落点分配：(1,0) 投 1 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "choose",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "选择落点",
    "description": "只有正确的落点组合才能得到十字；比较完整目标。",
    "board": {
      "width": 3,
      "height": 3,
      "initial": [
        0,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        1,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 1,
        "y": 1
      },
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 2,
        "y": 1
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 2,
    "referenceMoves": [
      {
        "x": 1,
        "y": 1
      },
      {
        "x": 1,
        "y": 1
      }
    ],
    "teaching": {
      "tier": "intro",
      "concept": "总量不能代替逐格比较",
      "hints": [
        "先比较初态与目标，注意“总量不能代替逐格比较”。每步只加一粒，未稳定时不能继续。",
        "不要把沙投向右侧或下侧的诱饵格。",
        "落点分配：(1,1) 投 2 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "combine",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "双源组合",
    "description": "两个沙源各有 3 粒。用两次投沙拼出对称图案。",
    "board": {
      "width": 5,
      "height": 5,
      "initial": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        3,
        1,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        3,
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 2,
        "y": 2
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 2,
    "referenceMoves": [
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      }
    ],
    "teaching": {
      "tier": "intro",
      "concept": "投沙次数的分配",
      "hints": [
        "先比较初态与目标，注意“投沙次数的分配”。每步只加一粒，未稳定时不能继续。",
        "两个左右沙源会把沙送向同一个中心。",
        "落点分配：(1,2) 投 1 次；(3,2) 投 1 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "bridge",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "桥上的临界点",
    "description": "四次投入、四个候选落点。看起来最满的中心，未必需要直接投沙。",
    "board": {
      "width": 5,
      "height": 5,
      "initial": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        2,
        3,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        0,
        2,
        0,
        1,
        1,
        3,
        1,
        1,
        0,
        2,
        0,
        2,
        0,
        0,
        0,
        1,
        0,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 2,
        "y": 2
      },
      {
        "x": 2,
        "y": 0
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 4,
    "referenceMoves": [
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      }
    ],
    "teaching": {
      "tier": "advanced",
      "concept": "间接激活中心",
      "hints": [
        "先比较初态与目标，注意“间接激活中心”。每步只加一粒，未稳定时不能继续。",
        "左右原有两粒，要各补到四；中心可以被邻居激活。",
        "落点分配：(1,2) 投 2 次；(3,2) 投 2 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "crossroad",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "十字路口",
    "description": "五次投入分配给五个位置。目标的某些粒数来自连锁，而非直接投放。",
    "board": {
      "width": 5,
      "height": 5,
      "initial": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        2,
        3,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        0,
        1,
        0,
        0,
        0,
        2,
        1,
        2,
        0,
        1,
        1,
        2,
        1,
        1,
        0,
        2,
        0,
        2,
        0,
        0,
        0,
        1,
        0,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 2,
        "y": 1
      },
      {
        "x": 2,
        "y": 3
      },
      {
        "x": 0,
        "y": 0
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 5,
    "referenceMoves": [
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 2,
        "y": 1
      },
      {
        "x": 2,
        "y": 1
      },
      {
        "x": 2,
        "y": 3
      }
    ],
    "teaching": {
      "tier": "advanced",
      "concept": "分配与传播叠加",
      "hints": [
        "先比较初态与目标，注意“分配与传播叠加”。每步只加一粒，未稳定时不能继续。",
        "比较四个方向缺口，左/右各一次；上方需要两次，下方一次。",
        "落点分配：(1,2) 投 1 次；(3,2) 投 1 次；(2,1) 投 2 次；(2,3) 投 1 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "shore",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "海岸的代价",
    "description": "五次投入复现目标，还要留意海岸流失的一粒。别把总量当作图案。",
    "board": {
      "width": 5,
      "height": 5,
      "initial": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        2,
        3,
        3,
        2,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        0,
        1,
        0,
        0,
        1,
        2,
        1,
        2,
        0,
        1,
        2,
        0,
        2,
        1,
        1,
        2,
        1,
        2,
        0,
        0,
        0,
        1,
        0,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 0,
        "y": 2
      },
      {
        "x": 1,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 2,
        "y": 2
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 5,
    "referenceMoves": [
      {
        "x": 0,
        "y": 2
      },
      {
        "x": 0,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 3,
        "y": 2
      },
      {
        "x": 2,
        "y": 2
      }
    ],
    "teaching": {
      "tier": "advanced",
      "concept": "边界耗散的账本",
      "hints": [
        "先比较初态与目标，注意“边界耗散的账本”。每步只加一粒，未稳定时不能继续。",
        "海岸与右侧先各补两次，再利用中心的那一次。",
        "落点分配：(0,2) 投 2 次；(3,2) 投 2 次；(2,2) 投 1 次。操作顺序不作为额外限制。"
      ]
    }
  },
  {
    "id": "critical-ring",
    "version": 1,
    "status": "verified",
    "rules": "square4-open-v1",
    "title": "临界环的回响",
    "description": "七乘七棋盘，六次投入、五个落点。局部一粒能走过多轮连锁。",
    "board": {
      "width": 7,
      "height": 7,
      "initial": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        3,
        3,
        3,
        0,
        0,
        0,
        3,
        2,
        2,
        2,
        3,
        0,
        0,
        0,
        3,
        3,
        3,
        0,
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "target": [
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        2,
        1,
        2,
        0,
        0,
        0,
        2,
        3,
        0,
        3,
        2,
        0,
        1,
        1,
        2,
        2,
        2,
        1,
        1,
        0,
        2,
        3,
        0,
        3,
        2,
        0,
        0,
        0,
        2,
        1,
        2,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0
      ]
    },
    "allowedDropCells": [
      {
        "x": 2,
        "y": 3
      },
      {
        "x": 4,
        "y": 3
      },
      {
        "x": 3,
        "y": 3
      },
      {
        "x": 0,
        "y": 0
      },
      {
        "x": 6,
        "y": 6
      }
    ],
    "grainPerMove": 1,
    "maxMoves": 6,
    "referenceMoves": [
      {
        "x": 2,
        "y": 3
      },
      {
        "x": 2,
        "y": 3
      },
      {
        "x": 2,
        "y": 3
      },
      {
        "x": 4,
        "y": 3
      },
      {
        "x": 4,
        "y": 3
      },
      {
        "x": 4,
        "y": 3
      }
    ],
    "teaching": {
      "tier": "advanced",
      "concept": "多波反馈与阿贝尔性质",
      "hints": [
        "先比较初态与目标，注意“多波反馈与阿贝尔性质”。每步只加一粒，未稳定时不能继续。",
        "集中在左右两个接点；角落是诱饵。同样投入的不同顺序终态相同，波次过程可以不同。",
        "落点分配：(2,3) 投 3 次；(4,3) 投 3 次。操作顺序不作为额外限制。"
      ]
    }
  }
];
  if(typeof module === 'object' && module.exports) module.exports = levels;
  else root.SandpileLevels = levels;
})(globalThis);
