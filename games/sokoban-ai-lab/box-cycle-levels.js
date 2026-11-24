"use strict";

// Original layouts: https://github.com/hotwords123/parabox/tree/main/levels/vanilla
BoxCampaign.cycle = [
  {
    "title": "循环 1",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "#########",
      "#r$bd$$ $",
      "## ###  #",
      "##      #",
      "##  @   #",
      "##      #",
      "#########",
      "#########"
    ],
    "rooms": {
      "b": [
        "###",
        "#.#",
        "#$#"
      ],
      "d": [
        "###",
        "# #",
        "# #"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "d",
    "colors": {
      "root": "#786efa",
      "b": "#aa4664",
      "d": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_line"
  },
  {
    "title": "循环 2",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "#########",
      "#########",
      "#########",
      "# @   ## ",
      "#     ###",
      "#     ###",
      "#r$ $$d$$",
      "#########"
    ],
    "rooms": {
      "d": [
        "###",
        "#  ",
        "###"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "d",
    "colors": {
      "root": "#786efa",
      "d": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_careful_left"
  },
  {
    "title": "循环 3",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#$b$# #",
      "#a$$# #",
      "#$$c# #",
      "#$$$d@#",
      "#$$$# #",
      "#   r #",
      "#######"
    ],
    "rooms": {
      "a": [
        "#####",
        "###  ",
        "#####",
        "#####",
        "#####"
      ],
      "b": [
        "#####",
        "     ",
        "#####",
        "#####",
        "#####"
      ],
      "c": [
        "#####",
        "     ",
        "#####",
        "#####",
        "#####"
      ],
      "d": [
        "#####",
        "   ##",
        "##   ",
        "#####",
        "#####"
      ]
    },
    "clones": {},
    "finish": [
      3,
      1
    ],
    "finishRoom": "a",
    "colors": {
      "root": "#786efa",
      "a": "#aa4664",
      "b": "#aa4664",
      "c": "#aa4664",
      "d": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_interlope_align"
  },
  {
    "title": "循环 4",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "#########",
      "###### ##",
      "$b$$e$ ##",
      "##### r##",
      "       ##",
      "   @   ##",
      "       ##",
      "#########"
    ],
    "rooms": {
      "b": [
        "###",
        "#  ",
        "###"
      ],
      "e": [
        "###",
        "#.#",
        "#$#"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "b",
    "colors": {
      "root": "#786efa",
      "b": "#aa4664",
      "e": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_interlope_2"
  },
  {
    "title": "循环 5",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "##$######",
      "##f######",
      "##$######",
      "##$######",
      "##b######",
      "##$###  #",
      "#  r  @ #",
      "#     ###",
      "#########"
    ],
    "rooms": {
      "b": [
        "#####",
        "# $.#",
        "# ###",
        "#  ##",
        "## ##"
      ],
      "f": [
        "###",
        "  #",
        "###"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "f",
    "colors": {
      "root": "#786efa",
      "b": "#aa4664",
      "f": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_interlope_from_back_2_v2"
  },
  {
    "title": "循环 6",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "###########",
      "###########",
      "###########",
      "###########",
      "###########",
      "#r$ $$a$$$$",
      "##  #######",
      "##         ",
      "## @       ",
      "##         ",
      "###########"
    ],
    "rooms": {
      "a": [
        "###",
        "# #",
        "# #"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "a",
    "colors": {
      "root": "#786efa",
      "a": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_align",
    "challenge": true
  },
  {
    "title": "循环 7",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "#r  z####",
      "# @#d####",
      "#  b$####",
      "#z$$$$$$f",
      "###a$e###",
      "####$####",
      "####c####",
      "####$####"
    ],
    "rooms": {
      "a": [
        "### #",
        "###  ",
        "#####",
        "#####",
        "#####"
      ],
      "b": [
        "#####",
        "#####",
        "    #",
        "### #",
        "### #"
      ],
      "c": [
        "### #",
        "### #",
        "### #",
        "### #",
        "### #"
      ],
      "d": [
        "#####",
        "#####",
        "#####",
        "# ###",
        "# ###"
      ],
      "e": [
        "# ###",
        "  ###",
        "#####",
        "#####",
        "#####"
      ],
      "f": [
        "#####",
        "     ",
        "#####",
        "#####",
        "#####"
      ]
    },
    "clones": {
      "z": "root"
    },
    "finish": [
      1,
      3
    ],
    "finishRoom": "d",
    "colors": {
      "root": "#786efa",
      "a": "#aa4664",
      "b": "#aa4664",
      "c": "#aa4664",
      "d": "#aa4664",
      "e": "#aa4664",
      "f": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_cross",
    "challenge": true
  },
  {
    "title": "循环 8",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "#       #",
      "#  $ $  #",
      "#       #",
      "#####   #",
      "####r  ##",
      "####b   #",
      "####@## #",
      "#### ## #"
    ],
    "rooms": {
      "b": [
        "###",
        "#  ",
        "###"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "b",
    "colors": {
      "root": "#786efa",
      "b": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "interlope_setup"
  },
  {
    "title": "循环 9",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "####d####",
      "####$####",
      "#### ####",
      "#     ###",
      "# z @ ###",
      "#     ###",
      "# $ $ ###",
      "#     #r#",
      "#     # #"
    ],
    "rooms": {
      "d": [
        "###",
        "#  ",
        "###"
      ]
    },
    "clones": {
      "z": "root"
    },
    "finish": [
      1,
      1
    ],
    "finishRoom": "d",
    "colors": {
      "root": "#786efa",
      "d": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "eat_cycle",
    "challenge": true
  },
  {
    "title": "循环 10",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "##     ##",
      "## r $ ##",
      "##   $ ##",
      "## @ $.##",
      "##    .##",
      "######.##",
      "######  #",
      "######.##"
    ],
    "rooms": {},
    "clones": {},
    "finish": [
      7,
      7
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#786efa"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_setup",
    "challenge": true
  },
  {
    "title": "循环 11",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "#########",
      "### ###.#",
      "### ### #",
      "##r$$$$f$",
      "####   ##",
      "##   $   ",
      "## @     ",
      "#########"
    ],
    "rooms": {
      "f": [
        "## ##",
        "#   #",
        "     ",
        "#   #",
        "## ##"
      ]
    },
    "clones": {},
    "finish": [
      3,
      2
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#786efa",
      "f": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "train"
  },
  {
    "title": "循环 12",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "#  #r####",
      "#@ #g####",
      "#  #f####",
      "#   e####",
      "#   d####",
      "#  #c####",
      "#  #b####",
      "####a####"
    ],
    "rooms": {
      "a": [
        "###",
        "  #",
        "###"
      ],
      "b": [
        "   ",
        "   ",
        "   "
      ],
      "c": [
        "   ",
        "   ",
        "   "
      ],
      "d": [
        "   ",
        "   ",
        "   "
      ],
      "e": [
        "   ",
        "   ",
        "   "
      ],
      "f": [
        "   ",
        "   ",
        "   "
      ],
      "g": [
        "   ",
        "   ",
        "   "
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "a",
    "colors": {
      "root": "#786efa",
      "a": "#aa4664",
      "b": "#aa4664",
      "c": "#aa4664",
      "d": "#aa4664",
      "e": "#aa4664",
      "f": "#aa4664",
      "g": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "train_align"
  },
  {
    "title": "循环 13",
    "hint": "本关包含方块穿过出入口后翻转的规则，请在套箱模式中游玩，不提供传送门转换。",
    "rows": [
      "###$###",
      "##b$i##",
      "###$h##",
      "###d###",
      "  a$ ##",
      "@ #r###",
      "z #####"
    ],
    "rooms": {
      "a": [
        "# ###",
        "# ###",
        "  ###",
        "#####",
        "#####"
      ],
      "b": [
        "    #",
        "    #",
        "    #",
        "     ",
        "    #"
      ],
      "d": [
        "### #",
        "### #",
        "### #",
        "###  ",
        "#####"
      ],
      "h": [
        "     ",
        "     ",
        "     ",
        "     ",
        "     "
      ],
      "i": [
        "     ",
        "     ",
        "     ",
        "#    ",
        "     "
      ]
    },
    "clones": {
      "z": "root"
    },
    "finish": [
      2,
      2
    ],
    "finishRoom": "b",
    "colors": {
      "root": "#786efa",
      "a": "#5abea0",
      "b": "#aa4664",
      "d": "#5abea0",
      "h": "#aa4664",
      "i": "#aa4664"
    },
    "flipped": [
      "root"
    ],
    "portalConversion": false,
    "conversionReason": "循环 13 包含翻转规则，不提供传送门转换，请在套箱模式中游玩。",
    "sourceFile": "flip_train"
  },
  {
    "title": "循环 14",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "##     ##",
      "## @ f ##",
      "##     ##",
      "a$c$r$g$i",
      "# #######",
      "# #######",
      "#########",
      "#########"
    ],
    "rooms": {
      "a": [
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#   #"
      ],
      "c": [
        "#    ",
        "#    ",
        "#    ",
        "#    ",
        "#    "
      ],
      "f": [
        "# #",
        "###",
        "###"
      ],
      "g": [
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "# z #"
      ],
      "i": [
        "    #",
        "    #",
        "    #",
        "    #",
        "    #"
      ]
    },
    "clones": {
      "z": "f"
    },
    "finish": [
      1,
      6
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#786efa",
      "a": "#5abea0",
      "c": "#5abea0",
      "f": "#aa4664",
      "g": "#5abea0",
      "i": "#5abea0"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "train_portal",
    "challenge": true
  },
  {
    "title": "循环 15",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#########",
      "## ######",
      "##@######",
      "## ######",
      "#z $$$$$r",
      "## #.#..#",
      "##$######",
      "##$######",
      "##$######"
    ],
    "rooms": {},
    "clones": {
      "z": "root"
    },
    "finish": [
      2,
      1
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#786efa"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "cycle_ref",
    "challenge": true
  },
  {
    "title": "循环 16",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#######",
      "#     #",
      "# b c #",
      "#     #",
      "# a @ #",
      "#     #",
      "#######"
    ],
    "rooms": {
      "a": [
        "     ",
        "     ",
        "     "
      ],
      "b": [
        "   ",
        "   ",
        "   ",
        "   ",
        "   "
      ],
      "c": [
        "###$#",
        "  #.#",
        "#####",
        "#####",
        "#####"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "c",
    "colors": {
      "root": "#85829f",
      "a": "#786efa",
      "b": "#aa4664",
      "c": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "oblong_intro",
    "compressedRooms": true
  },
  {
    "title": "循环 17",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      "#######",
      "#     #",
      "# b@e #",
      "#     #",
      "# $$$ #",
      "#     #",
      "#######"
    ],
    "rooms": {
      "b": [
        ".   ."
      ],
      "e": [
        ".",
        " ",
        " ",
        " ",
        "."
      ]
    },
    "clones": {},
    "finish": [
      3,
      1
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#85829f",
      "b": "#786efa",
      "e": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "5by1",
    "compressedRooms": true
  },
  {
    "title": "循环 18",
    "hint": "推箱链绕回自身时，整条循环链会同时前移一格。可以转成推箱子的传送门地图。",
    "rows": [
      ". . $  ",
      " @. $ $",
      "  . r  "
    ],
    "rooms": {},
    "clones": {},
    "finish": [
      0,
      2
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#85829f"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "7by3ref",
    "compressedRooms": true
  }
];
