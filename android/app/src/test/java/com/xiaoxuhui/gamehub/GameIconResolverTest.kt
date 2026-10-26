package com.xiaoxuhui.gamehub

import org.junit.Assert.assertEquals
import org.junit.Test

class GameIconResolverTest {
    @Test fun dedicatedIconsAreSelectedByStableGameId() {
        assertEquals(R.drawable.game_icon_abelian_sandpile, GameIconResolver.resolve("abelian-sandpile", "puzzle"))
        assertEquals(R.drawable.game_icon_lambda_diagram_game, GameIconResolver.resolve("lambda-diagram-game", "puzzle"))
        assertEquals(R.drawable.game_icon_mini_scratch, GameIconResolver.resolve("mini-scratch", "logic"))
        assertEquals(R.drawable.game_icon_logic_circuit, GameIconResolver.resolve("logic-circuit", "puzzle"))
        assertEquals(R.drawable.game_icon_traffic_planner, GameIconResolver.resolve("traffic-planner", "logic"))
        assertEquals(R.drawable.game_icon_memory_demo, GameIconResolver.resolve("memory-demo", "simulation"))
        assertEquals(R.drawable.game_icon_red_green_puzzle, GameIconResolver.resolve("red-green-puzzle", "logic"))
    }

    @Test fun gamesWithoutDedicatedArtAndUnknownIdsKeepCategoryFallback() {
        assertEquals(R.drawable.game_dynamic_puzzle, GameIconResolver.resolve("hex-cell-lab", "puzzle"))
        assertEquals(R.drawable.game_dynamic_logic, GameIconResolver.resolve("langtons-ant", "logic"))
        assertEquals(R.drawable.game_dynamic_simulation, GameIconResolver.resolve("turbowarp-neural-network", "simulation"))
        assertEquals(R.drawable.game_dynamic_generic, GameIconResolver.resolve("turbowarp-logic-lab", "unknown"))
        assertEquals(R.drawable.game_dynamic_generic, GameIconResolver.resolve("not-registered", null))
        assertEquals(R.drawable.game_dynamic_generic, GameIconResolver.resolve(null, null))
    }
}
