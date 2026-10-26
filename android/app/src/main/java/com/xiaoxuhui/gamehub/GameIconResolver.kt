package com.xiaoxuhui.gamehub

/** Maps dynamic game identity to bundled artwork, retaining category art as the safe fallback. */
internal object GameIconResolver {
    fun resolve(id: String?, kind: String?): Int = when (id) {
        "abelian-sandpile" -> R.drawable.game_icon_abelian_sandpile
        "lambda-diagram-game" -> R.drawable.game_icon_lambda_diagram_game
        "mini-scratch" -> R.drawable.game_icon_mini_scratch
        "logic-circuit" -> R.drawable.game_icon_logic_circuit
        "traffic-planner" -> R.drawable.game_icon_traffic_planner
        "memory-demo" -> R.drawable.game_icon_memory_demo
        "red-green-puzzle" -> R.drawable.game_icon_red_green_puzzle
        else -> fallback(kind)
    }

    fun fallback(kind: String?): Int = when (kind) {
        "puzzle" -> R.drawable.game_dynamic_puzzle
        "logic" -> R.drawable.game_dynamic_logic
        "simulation" -> R.drawable.game_dynamic_simulation
        else -> R.drawable.game_dynamic_generic
    }
}
