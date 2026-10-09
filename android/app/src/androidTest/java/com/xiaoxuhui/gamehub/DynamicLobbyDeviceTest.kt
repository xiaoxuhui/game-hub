package com.xiaoxuhui.gamehub

import android.content.Context
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Actual native controls and normal open path; only private stores/HTTPS streams are substituted. */
class DynamicLobbyDeviceTest {
    private val instrumentation=InstrumentationRegistry.getInstrumentation()
    private val name="配对练习 · 示范"
    private fun await(label:String,predicate:()->Boolean){val end=SystemClock.uptimeMillis()+20000;while(!predicate()){check(SystemClock.uptimeMillis()<end){"Timeout: $label"};Thread.sleep(50)}}
    private fun find(root:AccessibilityNodeInfo?,predicate:(AccessibilityNodeInfo)->Boolean):AccessibilityNodeInfo? {
        if(root==null)return null
        if(predicate(root))return root
        for(i in 0 until root.childCount)find(root.getChild(i),predicate)?.let {return it}
        return null
    }
    private fun click(text:String,scroll:Boolean=true){
        val end=SystemClock.uptimeMillis()+20000
        while(SystemClock.uptimeMillis()<end){
            val root=instrumentation.uiAutomation.rootInActiveWindow
            var target=find(root){it.isVisibleToUser && it.isEnabled && (it.text?.toString()==text || it.contentDescription?.toString()?.startsWith(text)==true)}
            if(target!=null){
                while(target!=null && !target.isClickable)target=target.parent
                if(target!=null && target.performAction(AccessibilityNodeInfo.ACTION_CLICK)){instrumentation.waitForIdleSync();return}
            }
            if(scroll)find(root){it.isScrollable}?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Thread.sleep(100)
        }
        throw AssertionError("Actual clickable control not found: $text")
    }
    private fun visible(text:String)=find(instrumentation.uiAutomation.rootInActiveWindow){it.isVisibleToUser && (it.text?.toString()==text || it.contentDescription?.toString()?.startsWith(text)==true)}!=null
    private fun shell(command:String)=ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(command)).bufferedReader().use {it.readText().trim()}
    private fun screenshot(name:String){
        instrumentation.waitForIdleSync();Thread.sleep(600)
        val bitmap=instrumentation.uiAutomation.takeScreenshot();assertNotNull(bitmap)
        val target=File(instrumentation.targetContext.externalCacheDir,"$name.png")
        target.outputStream().use {assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,it))};bitmap.recycle()
        println("Native UI screenshot: ${target.absolutePath}")
    }
    private fun js(scenario:ActivityScenario<MainActivity>,script:String):String {
        val latch=CountDownLatch(1);var result=""
        scenario.onActivity {activity->
            val view=MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.get(activity) as? WebView
            if(view==null){result="null";latch.countDown()}else view.evaluateJavascript(script){result=it;latch.countDown()}
        }
        assertTrue(latch.await(15,TimeUnit.SECONDS));return result
    }
    private fun page(scenario:ActivityScenario<MainActivity>)=await("actual demo page"){js(scenario,"document.readyState==='complete' && document.querySelectorAll('#cards button').length===6")=="true"}
    private fun withUi(configure:(DynamicCoordinatorDeviceTest.Harness)->Unit={},action:(DynamicCoordinatorDeviceTest.Harness,UpdateCoordinator,ActivityScenario<MainActivity>)->Unit){
        assumeTrue(instrumentation.context.assets.list("dynamic-demo-fixture").orEmpty().contains("game.zip"))
        DynamicCoordinatorDeviceTest.Harness().use {h->
            configure(h)
            val owner=h.owner()
            val coordinatorField=UpdateCoordinator::class.java.getDeclaredField("instance").apply {isAccessible=true}
            val runtimeField=ResourceRuntime::class.java.getDeclaredField("instance").apply {isAccessible=true}
            val oldCoordinator=coordinatorField.get(null);val oldRuntime=runtimeField.get(null)
            val runtime=ResourceRuntime::class.java.getDeclaredConstructor(Context::class.java).apply {isAccessible=true}.newInstance(h.context)
            ResourceRuntime::class.java.getDeclaredField("store").apply {isAccessible=true}.set(runtime,h.builtin)
            ResourceRuntime::class.java.getDeclaredField("dynamicStore").apply {isAccessible=true}.set(runtime,h.dynamic)
            coordinatorField.set(null,owner);runtimeField.set(null,runtime)
            try {ActivityScenario.launch(MainActivity::class.java).use {scenario->action(h,owner,scenario)}}
            finally {owner.presence(false,false);coordinatorField.set(null,oldCoordinator);runtimeField.set(null,oldRuntime)}
        }
    }
    @Test fun actualDirectoryInstallHomeOpenRecreateRemoveReinstallPreservesProgress(){withUi {h,owner,scenario->
        await("catalog query"){val s=owner.snapshot();!s.busy && s.dynamicCheckedAt!=null}
        assertEquals(0,h.zipCount());assertFalse(h.dynamic.installed("memory-demo"))
        scenario.onActivity {activity->
            @Suppress("UNCHECKED_CAST")
            val cards=MainActivity::class.java.getDeclaredField("gameCards").apply {isAccessible=true}.get(activity) as Map<String,View>
            for(id in listOf("conway","eml","light","turing")){
                val card=cards.getValue(id);val rect=Rect()
                assertTrue("$id must be visible without scrolling",card.getGlobalVisibleRect(rect))
                assertEquals("$id must fit completely on the initial four-game screen",card.height,rect.height())
            }
        }
        screenshot("n4-ui-four-home")
        click("游戏目录",false);click("安装$name")
        await("manual installation"){!owner.snapshot().busy && h.dynamic.installed("memory-demo")}
        click("关闭");click(name)
        page(scenario)
        val backup=js(scenario,"localStorage.getItem('memory-demo-state-v1')")
        try {
            assertEquals("true",js(scenario,"(()=>{document.querySelector('#restart').click();document.querySelector('#cards button').click();return JSON.parse(localStorage.getItem('memory-demo-state-v1')).open[0]===0})()"))
            scenario.recreate();page(scenario)
            assertEquals("0",js(scenario,"JSON.parse(localStorage.getItem('memory-demo-state-v1')).open[0]"))
            assertEquals("\"https://memory-demo.appassets.androidplatform.net\"",js(scenario,"location.origin"))
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
            await("hall after back"){visible("游戏目录")};screenshot("n4-ui-five-home")
            click("游戏目录",false);click("移除${name}资源（保留存档）");click("确认",false)
            await("removed"){!owner.snapshot().busy && !h.dynamic.installed("memory-demo")}
            click("关闭");assertFalse(visible(name))
            val downloads=h.zipCount();assertTrue(owner.check(true));await("removed recheck"){!owner.snapshot().busy}
            assertEquals(downloads,h.zipCount());assertFalse(h.dynamic.installed("memory-demo"))
            click("游戏目录",false);click("安装$name");await("reinstalled"){!owner.snapshot().busy && h.dynamic.installed("memory-demo")}
            click("关闭");click(name);page(scenario)
            assertEquals("0",js(scenario,"JSON.parse(localStorage.getItem('memory-demo-state-v1')).open[0]"))
        } finally {
            page(scenario)
            if(backup=="null")js(scenario,"localStorage.removeItem('memory-demo-state-v1')")
            else js(scenario,"localStorage.setItem('memory-demo-state-v1', $backup)")
        }
    }}
    @Test fun largeFontLandscapeDirectoryAndInstalledCardsRemainScrollable(){withUi {h,owner,scenario->
        await("query"){!owner.snapshot().busy && owner.snapshot().dynamicCheckedAt!=null}
        val priorFont=shell("settings get system font_scale")
        val priorRotation=shell("settings get system user_rotation")
        val priorAccelerometer=shell("settings get system accelerometer_rotation")
        try {
            shell("settings put system font_scale 1.6")
            scenario.onActivity {it.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE}
            println("Font-scale setting readback: ${shell("settings get system font_scale")}")
            await("real large font landscape"){var good=false;scenario.onActivity {good=it.resources.configuration.fontScale>=1.5f && it.resources.configuration.orientation==Configuration.ORIENTATION_LANDSCAPE};good}
            // Presentation-only synthetic entries; signed producer/network installation is tested above.
            val sample=h.current.first.games.single()
            val remotes=(1..8).map {sample.copy(id="layout-$it",displayName="布局验证游戏 $it",minHost=5)}
            val locals=remotes.associate {game->game.id to LocalResourceInfo(ResourceSelection(active=game.identity,highestCode=1),game,null,null,null,null,true)}
            val snapshot=owner.snapshot().copy(dynamicCatalogGames=remotes,localDynamicResources=locals,dynamicResources=emptyList(),dynamicStatus="布局夹具：8 项，不可安装")
            UpdateCoordinator::class.java.getDeclaredField("state").apply {isAccessible=true}.set(owner,snapshot)
            scenario.onActivity {MainActivity::class.java.getDeclaredMethod("renderUpdates",UpdateSnapshot::class.java).apply {isAccessible=true}.invoke(it,snapshot)}
            screenshot("n4-ui-landscape-large-font")
            click("游戏目录",false)
            click("打开布局验证游戏 8")
            // Synthetic assets do not exist; actual error screen must offer a usable return control.
            click("返回大厅")
            repeat(12){if(!visible("游戏目录"))find(instrumentation.uiAutomation.rootInActiveWindow){it.isScrollable}?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)}
            await("returned"){visible("游戏目录")}
            println("Actual landscape fontScale=1.6 directory scroll/control activation passed; synthetic layout assets intentionally unavailable.")
        } finally {
            scenario.onActivity {it.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED}
            for((key,value) in listOf("font_scale" to priorFont,"user_rotation" to priorRotation,"accelerometer_rotation" to priorAccelerometer)){
                if(value=="null")shell("settings delete system $key")else shell("settings put system $key $value")
            }
        }
    }}
    @Test fun futureHostGameExplainsCompatibilityAndOffersNoInstall(){withUi({h->h.current=h.fixture.dynamicRelease(minHost=5)}) {h,owner,_->
        await("future game query"){!owner.snapshot().busy && owner.snapshot().dynamicCheckedAt!=null}
        click("游戏目录",false)
        await("actual compatibility explanation"){visible("此游戏与当前大厅不兼容。请在更新详情检查大厅升级；升级前不会下载此游戏。")}
        assertFalse(visible("安装$name"));assertEquals(0,h.zipCount());assertFalse(h.dynamic.installed("memory-demo"))
        screenshot("n4-ui-incompatible-directory")
    }}
}
