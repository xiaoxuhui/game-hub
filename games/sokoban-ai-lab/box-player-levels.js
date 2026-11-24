"use strict";

// Original layouts: https://github.com/hotwords123/parabox/tree/main/levels/vanilla
BoxCampaign.player = [
  {
    "players": [
      [
        "root",
        5,
        2
      ]
    ],
    "finishes": [
      [
        "root",
        7,
        7
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 1",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#########",
      "##     ##",
      "##   a ##",
      "##$    ##",
      "## ######",
      "##  $   #",
      "####  # #",
      "####### #",
      "#########"
    ],
    "rooms": {
      "a": [
        "## ##",
        "#####",
        "#####",
        "#####",
        "## ##"
      ]
    },
    "clones": {},
    "finish": [
      7,
      7
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "playerr_first"
  },
  {
    "players": [
      [
        "root",
        4,
        2
      ]
    ],
    "finishes": [
      [
        "root",
        2,
        2
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 2",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#     #",
      "#   b #",
      "#     #",
      "#  $$ #",
      "#a    #",
      "#######"
    ],
    "rooms": {
      "a": [
        "###",
        "#.#",
        "# #"
      ],
      "b": [
        "###",
        "###",
        "# #"
      ]
    },
    "clones": {},
    "finish": [
      2,
      2
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#786efa",
      "b": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "hungry"
  },
  {
    "players": [
      [
        "root",
        6,
        5
      ]
    ],
    "finishes": [
      [
        "root",
        1,
        5
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 3",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#########",
      "##      #",
      "## $### #",
      "###  # $#",
      "#### #  #",
      "# #  #a #",
      "# #$ #  #",
      "#$  #####",
      "#########"
    ],
    "rooms": {
      "a": [
        "## ##",
        "#####",
        " ### ",
        "#####",
        "## ##"
      ]
    },
    "clones": {},
    "finish": [
      1,
      5
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "playerr_eat_four_correct"
  },
  {
    "players": [
      [
        "root",
        3,
        3
      ]
    ],
    "finishes": [
      [
        "root",
        5,
        3
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 4",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#  $  #",
      "#     #",
      "#$ a  #",
      "#     #",
      "#  $  #",
      "#######"
    ],
    "rooms": {
      "a": [
        "     ",
        "     ",
        "  .  ",
        "     ",
        "     "
      ]
    },
    "clones": {},
    "finish": [
      5,
      3
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "eat_same_side"
  },
  {
    "players": [
      [
        "root",
        3,
        2
      ]
    ],
    "finishes": [
      [
        "b",
        1,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 5",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#     #",
      "#  a  #",
      "#     #",
      "#   ###",
      "# $$$b#",
      "#######"
    ],
    "rooms": {
      "a": [
        "   ",
        "   ",
        "   "
      ],
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
      "root": "#cbcbce",
      "a": "#cf197a",
      "b": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "digest_2"
  },
  {
    "players": [
      [
        "root",
        3,
        5
      ]
    ],
    "finishes": [
      [
        "b",
        1,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 6",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#######",
      "#$ $ $#",
      "#     #",
      "##   ##",
      "## a ##",
      "#######"
    ],
    "rooms": {
      "a": [
        "# #",
        "#b#",
        "# #"
      ],
      "b": [
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
    "finishRoom": "b",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a",
      "b": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "digest_backing_1"
  },
  {
    "players": [
      [
        "root",
        2,
        4
      ]
    ],
    "finishes": [
      [
        "root",
        7,
        3
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 7",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#########",
      "#########",
      "#$  $####",
      "#    #. #",
      "# a    ##",
      "#    #$##",
      "#$  b####",
      "#########",
      "#########"
    ],
    "rooms": {
      "a": [
        "   ",
        "   ",
        "   "
      ],
      "b": [
        "###",
        "#  ",
        "# #"
      ]
    },
    "clones": {},
    "finish": [
      7,
      3
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a",
      "b": "#786efa"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "digest_eject_elbow"
  },
  {
    "players": [
      [
        "root",
        3,
        1
      ]
    ],
    "finishes": [
      [
        "root",
        3,
        5
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 8",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "## b###",
      "#a   $#",
      "#    $#",
      "#    $#",
      "#     #",
      "#######"
    ],
    "rooms": {
      "a": [
        "###",
        ".##",
        "###"
      ],
      "b": [
        "###",
        "   ",
        "###"
      ]
    },
    "clones": {},
    "finish": [
      3,
      5
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#aa4664",
      "b": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "digest_backing_3_v2",
    "challenge": true
  },
  {
    "players": [
      [
        "root",
        3,
        2
      ]
    ],
    "finishes": [
      [
        "a",
        2,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 9",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#####",
      "#a  #",
      "## z#",
      "#$  #",
      "#####"
    ],
    "rooms": {
      "a": [
        "     ",
        "     ",
        "  .  ",
        "     ",
        "     "
      ]
    },
    "clones": {
      "z": "a"
    },
    "finish": [
      2,
      1
    ],
    "finishRoom": "a",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "player_clone_rescue_v2"
  },
  {
    "players": [
      [
        "root",
        4,
        2
      ]
    ],
    "finishes": [
      [
        "root",
        5,
        7
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 10",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#########",
      "##    $##",
      "##  z  ##",
      "##  a  ##",
      "##    z##",
      "## ######",
      "##   .###",
      "##    ###",
      "#########"
    ],
    "rooms": {
      "a": [
        "#####",
        "#    ",
        "#    ",
        "#    ",
        "#####"
      ]
    },
    "clones": {
      "z": "a"
    },
    "finish": [
      5,
      7
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "carry_player",
    "challenge": true
  },
  {
    "players": [
      [
        "a",
        2,
        2
      ]
    ],
    "finishes": [
      [
        "a",
        0,
        3
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 11",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#####",
      "#####",
      "##a##",
      "#####",
      "#####"
    ],
    "rooms": {
      "a": [
        "     ",
        "b   .",
        "  z $",
        "    .",
        "     "
      ],
      "b": [
        "   ",
        "   ",
        "   "
      ]
    },
    "clones": {
      "z": "a"
    },
    "finish": [
      0,
      3
    ],
    "finishRoom": "a",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a",
      "b": "#786efa"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "playerr_carousel",
    "challenge": true
  },
  {
    "players": [
      [
        "root",
        3,
        2
      ]
    ],
    "finishes": [
      [
        "b",
        1,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 12",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#     #",
      "#  a  #",
      "#     #",
      "##  ###",
      "#    $#",
      "#######"
    ],
    "rooms": {
      "a": [
        "$$$$$",
        "$$$$$",
        "$$$$c",
        "$$$$$",
        "$$b$$"
      ],
      "b": [
        "###",
        "#  ",
        "###"
      ],
      "c": [
        "#####",
        "#   #",
        "  #$#",
        "###.#",
        "#####"
      ]
    },
    "clones": {},
    "finish": [
      1,
      1
    ],
    "finishRoom": "b",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a",
      "b": "#aa4664",
      "c": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "full_v2"
  },
  {
    "players": [
      [
        "root",
        3,
        2
      ]
    ],
    "finishes": [
      [
        "b",
        1,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 13",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "         ",
      "         ",
      "   a     ",
      "#        ",
      "#        ",
      "##### ###",
      "##z## ###",
      "#zr##  $#",
      "#########"
    ],
    "rooms": {
      "a": [
        "$$$$$",
        "$$$$$",
        "$$$$$",
        "$$$b$",
        "$$$$$"
      ],
      "b": [
        "###",
        "#  ",
        "###"
      ]
    },
    "clones": {
      "z": "a"
    },
    "finish": [
      1,
      1
    ],
    "finishRoom": "b",
    "colors": {
      "root": "#786efa",
      "a": "#cf197a",
      "b": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "full_align"
  },
  {
    "players": [
      [
        "root",
        4,
        6
      ]
    ],
    "finishes": [
      [
        "c",
        1,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 14",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#########",
      "#########",
      "##a   ###",
      "#     #$#",
      "# # z # #",
      "#       #",
      "#   b ###",
      "#     ###",
      "#########"
    ],
    "rooms": {
      "a": [
        "     ",
        "     ",
        "     ",
        "     ",
        "     "
      ],
      "b": [
        "$$$$$",
        "$$$$$",
        "$$$$$",
        "$c$$$",
        "$$$$$"
      ],
      "c": [
        "# #",
        "# #",
        "###"
      ]
    },
    "clones": {
      "z": "b"
    },
    "finish": [
      1,
      1
    ],
    "finishRoom": "c",
    "colors": {
      "root": "#cbcbce",
      "a": "#786efa",
      "b": "#cf197a",
      "c": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "full_align_2"
  },
  {
    "players": [
      [
        "root",
        4,
        4
      ]
    ],
    "finishes": [
      [
        "root",
        1,
        7
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 15",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#$#####$#",
      "$$     $$",
      "#       #",
      "#       #",
      "#   b   #",
      "##      #",
      "#$ #    #",
      "# ##   $$",
      "####a##$#"
    ],
    "rooms": {
      "a": [
        "###",
        " ##",
        "###"
      ],
      "b": [
        "##$##",
        "##$##",
        "$$r$$",
        "##$##",
        "##$##"
      ]
    },
    "clones": {},
    "finish": [
      1,
      7
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#786efa",
      "a": "#aa4664",
      "b": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "playerr_cycle_carry"
  },
  {
    "players": [
      [
        "root",
        3,
        3
      ]
    ],
    "finishes": [
      [
        "root",
        5,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 16",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#a    #",
      "#$    #",
      "#$ b   ",
      "#$    #",
      "#    r#",
      "#######"
    ],
    "rooms": {
      "a": [
        "###",
        "##.",
        "###"
      ],
      "b": [
        "# #",
        "#  ",
        "###"
      ]
    },
    "clones": {},
    "finish": [
      5,
      1
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#786efa",
      "a": "#aa4664",
      "b": "#cf197a"
    },
    "flipped": [
      "root"
    ],
    "portalConversion": false,
    "sourceFile": "hungry_flip",
    "conversionReason": "本关包含翻转规则，不提供传送门转换。",
    "challenge": true
  },
  {
    "players": [
      [
        "root",
        3,
        2
      ]
    ],
    "finishes": [
      [
        "root",
        3,
        4
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 17",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#a   r#",
      "#  z  #",
      "# ...  ",
      "#     #",
      "#z   $#",
      "#######"
    ],
    "rooms": {
      "a": [
        "## ##",
        "## ##",
        "#  ##",
        "#  ##",
        "#####"
      ]
    },
    "clones": {
      "z": "root"
    },
    "finish": [
      3,
      4
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cf197a",
      "a": "#5abea0"
    },
    "flipped": [
      "root"
    ],
    "portalConversion": false,
    "sourceFile": "hungry_ref_flip",
    "conversionReason": "本关包含翻转规则，不提供传送门转换。",
    "challenge": true
  },
  {
    "players": [
      [
        "root",
        3,
        3
      ]
    ],
    "finishes": [
      [
        "a",
        1,
        5
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 18",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#######",
      "#     #",
      "# r $ #",
      "#  a   ",
      "# $ $ #",
      "#     #",
      "#######"
    ],
    "rooms": {
      "a": [
        "### ###",
        "### ###",
        "### ###",
        "#    .#",
        "#     #",
        "#     #",
        "#######"
      ]
    },
    "clones": {},
    "finish": [
      1,
      5
    ],
    "finishRoom": "a",
    "colors": {
      "root": "#786efa",
      "a": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "get_inside_yourself"
  },
  {
    "players": [
      [
        "root",
        2,
        2
      ]
    ],
    "finishes": [
      [
        "a",
        1,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 19",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "       ",
      "       ",
      "  r #  ",
      "       ",
      "  $ $  ",
      "       ",
      "a      "
    ],
    "rooms": {
      "a": [
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
    "finishRoom": "a",
    "colors": {
      "root": "#cf197a",
      "a": "#aa4664"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "player_cycle_rescue"
  },
  {
    "players": [
      [
        "root",
        4,
        6
      ]
    ],
    "finishes": [
      [
        "root",
        4,
        5
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 20",
    "hint": "玩家自身也有内部地图，能吞入和带着其他方块移动。",
    "rows": [
      "#### ####",
      "      z  ",
      "         ",
      "         ",
      "  . # .  ",
      "         ",
      "    r    ",
      "         ",
      "  z      "
    ],
    "rooms": {},
    "clones": {
      "z": "root"
    },
    "finish": [
      4,
      5
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "rescue_my_clones",
    "challenge": true
  },
  {
    "players": [
      [
        "root",
        4,
        3
      ],
      [
        "root",
        2,
        3
      ]
    ],
    "finishes": [
      [
        "root",
        3,
        5
      ],
      [
        "root",
        3,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 21",
    "hint": "多个玩家按同一方向同步行动。转成传送门地图后，可以在推箱子模式选择同步或切换控制。",
    "rows": [
      "#######",
      "#a    #",
      "#     #",
      "# @ @ #",
      "#     #",
      "#     #",
      "#######"
    ],
    "rooms": {
      "a": [
        "   ",
        "   ",
        "   "
      ]
    },
    "clones": {},
    "finish": [
      3,
      1
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#786efa"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "multi_valign"
  },
  {
    "players": [
      [
        "root",
        1,
        5
      ],
      [
        "root",
        2,
        5
      ]
    ],
    "finishes": [
      [
        "root",
        4,
        1
      ],
      [
        "a",
        3,
        3
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 22",
    "hint": "多个玩家按同一方向同步行动。转成传送门地图后，可以在推箱子模式选择同步或切换控制。",
    "rows": [
      "#######",
      "#    ##",
      "#    ##",
      "# a  ##",
      "#    .#",
      "#@@  ##",
      "#######"
    ],
    "rooms": {
      "a": [
        "#####",
        "#####",
        "#####",
        "##  #",
        "## ##"
      ]
    },
    "clones": {},
    "finish": [
      3,
      3
    ],
    "finishRoom": "a",
    "colors": {
      "root": "#cbcbce",
      "a": "#786efa"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "multi_gun"
  },
  {
    "players": [
      [
        "root",
        5,
        4
      ],
      [
        "root",
        5,
        6
      ],
      [
        "root",
        5,
        8
      ]
    ],
    "finishes": [
      [
        "root",
        3,
        6
      ],
      [
        "root",
        6,
        8
      ],
      [
        "root",
        7,
        4
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 23",
    "hint": "多个玩家按同一方向同步行动。转成传送门地图后，可以在推箱子模式选择同步或切换控制。",
    "rows": [
      "###########",
      "#zzzzzzzzz#",
      "#    r    #",
      "#         #",
      "#    @    #",
      "#         #",
      "#    @    #",
      "#         #",
      "#    @    #",
      "#         #",
      "#         #"
    ],
    "rooms": {},
    "clones": {
      "z": "root"
    },
    "finish": [
      7,
      4
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#786efa"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "multi_valign_ref"
  },
  {
    "players": [
      [
        "root",
        2,
        3
      ],
      [
        "root",
        4,
        3
      ]
    ],
    "finishes": [
      [
        "root",
        2,
        1
      ],
      [
        "root",
        3,
        1
      ]
    ],
    "playerMode": "sync",
    "title": "玩家 24",
    "hint": "多个玩家按同一方向同步行动。转成传送门地图后，可以在推箱子模式选择同步或切换控制。",
    "rows": [
      "#######",
      "##  ###",
      "#     #",
      "# a b #",
      "#     #",
      "#     #",
      "#######"
    ],
    "rooms": {
      "a": [
        "     ",
        "     ",
        "  .  ",
        "     ",
        "     "
      ],
      "b": [
        "     ",
        "     ",
        "  $  ",
        "     ",
        "     "
      ]
    },
    "clones": {},
    "finish": [
      3,
      1
    ],
    "finishRoom": "root",
    "colors": {
      "root": "#cbcbce",
      "a": "#cf197a",
      "b": "#cf197a"
    },
    "flipped": [],
    "portalConversion": true,
    "sourceFile": "multi_swap"
  }
];
