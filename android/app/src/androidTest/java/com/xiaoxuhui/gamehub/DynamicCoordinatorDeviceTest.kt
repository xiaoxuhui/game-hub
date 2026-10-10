package com.xiaoxuhui.gamehub

import android.content.Context
import android.content.ContextWrapper
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Controlled HTTPS streams with real signed producer bytes, AtomicFile, both stores and production coordinator. */
class DynamicCoordinatorDeviceTest {
    internal class Harness:AutoCloseable {
        val base=InstrumentationRegistry.getInstrumentation().targetContext
        val fixture=ResourceDeviceFixture(base)
        val names=mutableSetOf<String>()
        val context=object:ContextWrapper(base){
            override fun getApplicationContext():Context=this
            override fun getFilesDir()=File(fixture.root,"three-channel-files").apply {mkdirs()}
            override fun getCacheDir()=File(fixture.root,"three-channel-cache").apply {mkdirs()}
            override fun getSharedPreferences(name:String,mode:Int):android.content.SharedPreferences {
                val unique=fixture.root.name+"-"+name;names.add(unique);return base.getSharedPreferences(unique,mode)
            }
        }
        val builtinRoot=File(context.filesDir.canonicalFile,"builtin")
        val dynamicRoot=File(context.filesDir.canonicalFile,"dynamic")
        val builtin=GameResourceStore(builtinRoot,4,fixture.publicKey,otherResourceBytes={ResourceDiskBudget.usedBytes(dynamicRoot)})
        val dynamic=GameResourceStore(dynamicRoot,4,fixture.publicKey,policy=ResourceStorePolicy.DYNAMIC,otherResourceBytes={ResourceDiskBudget.usedBytes(builtinRoot)})
        @Volatile var network=UpdateNetwork(true,true)
        @Volatile var dynamicStatus=200
        @Volatile var apkStatus=200
        @Volatile var block=false
        @Volatile var corrupt=false
        var current=fixture.dynamicRelease()
        val builtinEnvelope=fixture.onlyLightEnvelope()
        val builtinCatalog=ResourcePolicy.verifyEnvelope(builtinEnvelope,fixture.publicKey)
        val requests=CopyOnWriteArrayList<String>()
        val disconnected=CopyOnWriteArrayList<String>()
        val entered=CountDownLatch(1);val release=CountDownLatch(1)
        val owners=mutableListOf<UpdateCoordinator>()
        private val http=PublicReleaseHttp({address->connection(address)})
        fun owner()=UpdateCoordinator.createForVerification(context,CoordinatorVerificationEnvironment(builtin,fixture.publicKey,http,{network},dynamic)).also {owners.add(it)}
        fun asset(game:ResourceGame)=JSONObject().put("id",game.assetId).put("name",game.assetName).put("size",game.archiveBytes).put("digest","sha256:${game.archiveSha256}").put("state","uploaded")
        private fun connection(address:String):HttpURLConnection {
            requests.add(address);var status=200
            val bytes=when {
                address.endsWith("/releases/latest")->{status=apkStatus;JSONObject().put("draft",false).put("prerelease",false).put("tag_name","v0.4.2").put("assets",JSONArray().put(JSONObject().put("id",900).put("name","game-hub.apk").put("size",1234).put("digest","sha256:${"a".repeat(64)}"))).toString().toByteArray()}
                address.endsWith("/releases/tags/game-resources-v1")->JSONObject().put("id",1).put("draft",false).put("prerelease",true).put("tag_name","game-resources-v1").toString().toByteArray()
                address.endsWith("/releases/tags/game-resources-v2")->{status=dynamicStatus;JSONObject().put("id",2).put("draft",false).put("prerelease",true).put("tag_name","game-resources-v2").toString().toByteArray()}
                address.endsWith("/releases/1/assets?per_page=100&page=1")->JSONArray().put(JSONObject().put("id",50).put("name","catalog.signed.json").put("size",builtinEnvelope.size).put("digest","sha256:${ResourcePolicy.sha256(builtinEnvelope)}").put("state","uploaded")).apply {builtinCatalog.games.forEach {put(asset(it))}}.toString().toByteArray()
                address.endsWith("/releases/2/assets?per_page=100&page=1")->JSONArray().put(JSONObject().put("id",150).put("name","catalog.signed.json").put("size",current.second.size).put("digest","sha256:${ResourcePolicy.sha256(current.second)}").put("state","uploaded")).put(asset(current.first.games.single())).toString().toByteArray()
                address.endsWith("/releases/assets/50")->builtinEnvelope
                address.endsWith("/releases/assets/150")->current.second
                address.endsWith("/releases/assets/701")->current.third.clone().also {if(corrupt)it[0]=(it[0].toInt() xor 1).toByte()}
                else ->fixture.archiveBytes(builtinCatalog.games.single {address.endsWith("/releases/assets/${it.assetId}")}.id)
            }
            return object:HttpURLConnection(URL(address)){
                override fun connect(){};override fun usingProxy()=false;override fun disconnect(){disconnected.add(address)}
                override fun getResponseCode()=status
                override fun getHeaderField(name:String?)=if(name=="Retry-After")"60" else null
                override fun getContentLengthLong()=bytes.size.toLong()
                override fun getInputStream():InputStream {
                    val stream=ByteArrayInputStream(bytes)
                    if(!block || !address.endsWith("/releases/assets/701"))return stream
                    return object:java.io.FilterInputStream(stream){
                        private var reads=0
                        override fun read(buffer:ByteArray,offset:Int,length:Int):Int {
                            if(reads++==1){entered.countDown();check(release.await(25,TimeUnit.SECONDS))}
                            return `in`.read(buffer,offset,length)
                        }
                    }
                }
            }
        }
        fun installFirst(){
            val archive=File(fixture.root,"initial-dynamic.zip").apply {writeBytes(current.third)}
            dynamic.install(dynamic.acceptCatalog(current.second).games.single(),current.second,archive)
            dynamic.openSession("memory-demo",true).use {assertEquals(1,it.game!!.contentCode)}
        }
        fun zipCount()=requests.count {it.endsWith("/releases/assets/701")}
        override fun close(){release.countDown();owners.forEach {it.closeVerification()};names.forEach {base.deleteSharedPreferences(it)};fixture.close()}
    }
    private fun harness():Harness {
        assumeTrue("Prepare actual pinned producer fixture",InstrumentationRegistry.getInstrumentation().context.assets.list("dynamic-demo-fixture").orEmpty().contains("game.zip"))
        return Harness()
    }
    private fun await(label:String,predicate:()->Boolean){val end=System.nanoTime()+TimeUnit.SECONDS.toNanos(30);while(!predicate()){check(System.nanoTime()<end){"Timeout: $label"};Thread.sleep(25)}}
    private fun checked(owner:UpdateCoordinator)=await("three-channel query/cleanup"){val s=owner.snapshot();s.apkCheckedAt!=null && s.resourcesCheckedAt!=null && s.dynamicCheckedAt!=null && !s.busy}
    @Test fun wifiFirstInstallIsManualAndRemovedGameNeverAutomaticallyReinstalls(){harness().use {h->
        val owner=h.owner();owner.presence(true,true);checked(owner)
        assertEquals(0,h.zipCount());assertFalse(h.dynamic.installed("memory-demo"));assertEquals(1,owner.snapshot().dynamicResources.size)
        assertTrue(owner.downloadResource("memory-demo",false));await("manual ready"){!owner.snapshot().busy && h.dynamic.installed("memory-demo")}
        assertEquals(1,h.zipCount());assertEquals(1,owner.snapshot().localDynamicResources["memory-demo"]!!.ready!!.contentCode)
        assertTrue(owner.changeLocal("memory-demo",LocalResourceAction.REMOVE));await("removed"){!owner.snapshot().busy && !h.dynamic.installed("memory-demo")}
        assertEquals(1,h.dynamic.selection("memory-demo").highestCode)
        assertTrue(owner.check(true));checked(owner);assertEquals(1,h.zipCount());assertFalse(h.dynamic.installed("memory-demo"))
        assertEquals("0.4.2",owner.snapshot().apk!!.version);assertFalse(h.requests.any {it.endsWith("/releases/assets/900")})
    }}
    @Test fun installedCompatibleGameUpdatesAutomaticallyAndRetirementClearsOnlyReady(){harness().use {h->
        h.installFirst();h.current=h.fixture.dynamicRelease(2,2)
        val owner=h.owner();owner.presence(true,true);checked(owner)
        await("automatic ready"){!owner.snapshot().busy && h.dynamic.selection("memory-demo").ready!=null}
        assertEquals(1,h.zipCount());assertEquals(2,owner.snapshot().localDynamicResources["memory-demo"]!!.ready!!.contentCode)
        h.current=h.fixture.dynamicRelease(3,2,available=false);assertTrue(owner.check(true));checked(owner)
        assertFalse(h.dynamic.selection("memory-demo").available);assertNull(h.dynamic.selection("memory-demo").ready)
        h.dynamic.openSession("memory-demo",true).use {assertEquals(1,it.game!!.contentCode)}
        assertEquals(1,h.zipCount())
    }}
    @Test fun blockedDynamicReadRetainsGlobalBusyUntilCancelledBytesAreCleaned(){harness().use {h->
        h.installFirst();h.current=h.fixture.dynamicRelease(2,2);h.block=true
        val owner=h.owner();owner.presence(true,true);assertTrue(h.entered.await(20,TimeUnit.SECONDS))
        assertTrue("Actual partial bytes exist before cancellation",File(h.context.cacheDir,"resource-updates").listFiles().orEmpty().any {it.length()>0})
        assertFalse(owner.changeLocal("memory-demo",LocalResourceAction.REMOVE));assertFalse(owner.downloadApk(true));assertFalse(owner.check(true))
        owner.presence(false,false);assertTrue(owner.snapshot().busy);assertFalse(owner.changeLocal("memory-demo",LocalResourceAction.REMOVE))
        h.release.countDown();await("cancel cleanup"){!owner.snapshot().busy}
        assertNull(h.dynamic.selection("memory-demo").ready);assertTrue(File(h.context.cacheDir,"resource-updates").listFiles().orEmpty().isEmpty())
        assertEquals(h.requests.size,h.disconnected.size)
        owner.presence(true,true);Thread.sleep(200);assertEquals(1,h.zipCount())
    }}
    @Test fun dynamic429BackoffPersistsWhileV1AndApkRemainAvailable(){harness().use {h->
        h.dynamicStatus=429;val owner=h.owner();owner.presence(true,true)
        await("independent failure"){!owner.snapshot().busy && owner.snapshot().resourcesCheckedAt!=null && owner.snapshot().apkCheckedAt!=null}
        assertNull(owner.snapshot().dynamicCheckedAt);assertEquals(0,h.zipCount());assertEquals("0.4.2",owner.snapshot().apk!!.version)
        val before=h.requests.count {it.endsWith("/releases/tags/game-resources-v2")}
        assertTrue(owner.check(true));await("recheck done"){!owner.snapshot().busy};assertEquals(before,h.requests.count {it.endsWith("/releases/tags/game-resources-v2")})
        val next=h.owner();next.presence(true,true);await("owner restart"){!next.snapshot().busy && next.snapshot().resourcesCheckedAt!=null}
        assertEquals(before,h.requests.count {it.endsWith("/releases/tags/game-resources-v2")})
    }}
    @Test fun installedDynamicFailurePersistsInDynamicStoreAndExplicitCodeOneRetryWorks(){harness().use {h->
        h.installFirst();val owner=h.owner();owner.presence(true,true);checked(owner)
        val identity=h.dynamic.selection("memory-demo").active
        h.dynamic.blockFailedIdentity("memory-demo",identity);owner.reportResourceFailure("memory-demo",identity)
        await("dynamic quarantine"){!owner.snapshot().busy && h.dynamic.selection("memory-demo").quarantine.contains(1)}
        assertTrue(h.dynamic.selection("memory-demo").pinned);assertTrue(h.builtin.selection("light").quarantine.isEmpty())
        val restarted=GameResourceStore(h.dynamicRoot,4,h.fixture.publicKey,policy=ResourceStorePolicy.DYNAMIC)
        assertTrue(restarted.selection("memory-demo").quarantine.contains(1))
        assertTrue(owner.changeLocal("memory-demo",LocalResourceAction.REMOVE));await("removed failed resource"){!owner.snapshot().busy && !h.dynamic.installed("memory-demo")}
        assertTrue(owner.changeLocal("memory-demo",LocalResourceAction.RETRY,1));await("retry durable"){!owner.snapshot().busy && h.dynamic.selection("memory-demo").quarantine.isEmpty()}
        assertEquals(0,h.zipCount());assertTrue(owner.downloadResource("memory-demo",false));await("retry installed"){!owner.snapshot().busy && h.dynamic.installed("memory-demo")}
    }}
    @Test fun sharedActualStoreBytesRejectDynamicInstallAndKeepBothOldSelections(){harness().use {h->
        h.installFirst();val owner=h.owner();owner.presence(true,true);checked(owner)
        await("builtin download cleanup"){!owner.snapshot().busy && h.builtin.selection("light").ready!=null}
        val builtinIdentity=h.builtin.selection("light").ready
        h.current=h.fixture.dynamicRelease(2,2)
        val game=h.current.first.games.single()
        val needed=game.files.sumOf {it.bytes}+game.archiveBytes+h.current.second.size
        val used=ResourceDiskBudget.usedBytes(h.builtinRoot)+ResourceDiskBudget.usedBytes(h.dynamicRoot)
        // Allow the two signed journals and state rewrite, but not archive/extraction staging.
        // A one-byte boundary is unstable while AtomicFile replaces its temporary/backup files.
        val remaining=h.current.second.size*2L+2048L
        assertTrue(remaining<needed)
        java.io.RandomAccessFile(File(h.builtinRoot,"shared-budget-private-fixture"),"rw").use {it.setLength(ResourcePolicy.MAX_STORE-used-remaining)}
        assertTrue(ResourceDiskBudget.usedBytes(h.builtinRoot)+ResourceDiskBudget.usedBytes(h.dynamicRoot)+needed>ResourcePolicy.MAX_STORE)
        assertTrue(owner.check(true))
        try {
            await("capacity rejection"){!owner.snapshot().busy && owner.snapshot().dynamicStatus.contains("资源空间不足")}
        } catch(error:Exception) {
            val state=owner.snapshot()
            throw AssertionError("Capacity diagnostic: busy=${state.busy}, dynamic=${state.dynamicStatus}, builtin=${state.resourceStatus}, selection=${h.dynamic.selection("memory-demo")}, needed=$needed, remaining=$remaining, initialUsed=$used, used=${ResourceDiskBudget.usedBytes(h.builtinRoot)+ResourceDiskBudget.usedBytes(h.dynamicRoot)}, requests=${h.requests}",error)
        }
        assertNull(h.dynamic.selection("memory-demo").ready)
        h.dynamic.openSession("memory-demo",true).use {assertEquals(1,it.game!!.contentCode)}
        assertEquals(builtinIdentity,h.builtin.selection("light").ready)
        assertTrue(File(h.context.cacheDir,"resource-updates").listFiles().orEmpty().isEmpty())
        assertTrue(ResourceDiskBudget.usedBytes(h.builtinRoot)+ResourceDiskBudget.usedBytes(h.dynamicRoot)<=ResourcePolicy.MAX_STORE)
    }}
    @Test fun incompatibleNewGameIsVisibleButCannotDownloadAndCorruptInstalledUpdateKeepsOld(){harness().use {h->
        h.current=h.fixture.dynamicRelease(minHost=6);val owner=h.owner();owner.presence(true,true);checked(owner)
        assertEquals(1,owner.snapshot().dynamicCatalogGames.size);assertTrue(owner.snapshot().dynamicResources.isEmpty())
        assertFalse(owner.downloadResource("memory-demo",true));assertEquals(0,h.zipCount())
    };harness().use {h->
        h.installFirst();h.current=h.fixture.dynamicRelease(2,2);h.corrupt=true
        val owner=h.owner();owner.presence(true,true)
        await("bad archive rejected"){!owner.snapshot().busy && owner.snapshot().dynamicStatus.contains("校验失败")}
        assertNull(h.dynamic.selection("memory-demo").ready)
        h.dynamic.openSession("memory-demo",true).use {assertEquals(1,it.game!!.contentCode)}
        assertTrue(File(h.context.cacheDir,"resource-updates").listFiles().orEmpty().isEmpty())
    }}
    @Test fun apk403CannotBlockDynamicAutoUpdateAndMissingV2DoesNotBlockOldChannels(){harness().use {h->
        h.installFirst();h.current=h.fixture.dynamicRelease(2,2);h.apkStatus=403
        val owner=h.owner();owner.presence(true,true)
        await("APK limit independent of dynamic download"){!owner.snapshot().busy && h.dynamic.selection("memory-demo").ready!=null}
        assertNull(owner.snapshot().apkCheckedAt);assertNotNull(owner.snapshot().resourcesCheckedAt);assertEquals(1,h.zipCount())
    };harness().use {h->
        h.dynamicStatus=404;val owner=h.owner();owner.presence(true,true)
        await("missing v2 independent"){!owner.snapshot().busy && owner.snapshot().apkCheckedAt!=null && owner.snapshot().resourcesCheckedAt!=null}
        assertNull(owner.snapshot().dynamicCheckedAt);assertEquals(0,h.zipCount())
        val before=h.requests.count {it.endsWith("/releases/tags/game-resources-v2")}
        assertTrue(owner.check(true));await("missing channel recheck"){!owner.snapshot().busy}
        assertEquals(before+1,h.requests.count {it.endsWith("/releases/tags/game-resources-v2")})
    }}
}
