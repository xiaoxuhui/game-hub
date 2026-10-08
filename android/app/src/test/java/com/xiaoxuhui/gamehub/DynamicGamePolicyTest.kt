package com.xiaoxuhui.gamehub

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64

class DynamicGamePolicyTest {
    private val now = 1791504000000L
    private fun fixture(): JSONObject = JSONObject().put("schemaVersion",2).put("channel",DynamicGamePolicy.CHANNEL)
        .put("releaseId",10).put("catalogSequence","1").put("issuedAt","2026-10-09T00:00:00.000Z").put("expiresAt","2026-10-10T00:00:00.000Z")
        .put("games",JSONArray().put(JSONObject().put("id","memory-demo").put("displayName","配对练习 · 示范").put("iconKind","puzzle").put("available",true)
            .put("resourceProtocol",2).put("bridgeProtocol",1).put("storageContract","memory-demo-dynamic-v1").put("minHostVersionCode",4).put("maxHostVersionCode",100)
            .put("version","1.0.0").put("contentCode",1).put("sourceRepository","https://github.com/xiaoxuhui/game-hub.git").put("sourceRevision","a".repeat(40))
            .put("entryPage","index.html").put("assetId",100).put("archiveBytes",100).put("archiveSha256","b".repeat(64)).put("releaseNotes","fixture")
            .put("files",JSONArray(listOf("index.html","LICENSE").map { JSONObject().put("path",it).put("bytes",10).put("sha256","c".repeat(64)).put("mime",ResourcePolicy.mime(it)) }))))
    private fun rejected(block: () -> Unit) { try { block(); fail("Expected rejection") } catch (_: Exception) {} }
    @Test fun futureCapabilitiesAreVisibleButCannotInstallAndV1RemainsFixed() {
        val json=fixture();val game=DynamicGamePolicy.parseCatalog(json,"d".repeat(64)).games.single()
        assertTrue(game.compatible(4,DynamicGamePolicy.contract(game.id)));assertFalse(game.compatible(3,DynamicGamePolicy.contract(game.id)))
        for(key in listOf("bridgeProtocol","resourceProtocol")) {val future=fixture();future.getJSONArray("games").getJSONObject(0).put(key,3);assertFalse(DynamicGamePolicy.parseCatalog(future,"d".repeat(64)).games.single().compatible(4,DynamicGamePolicy.contract(game.id)))}
        assertFalse(game.copy(storageContract="future-v2").compatible(4,DynamicGamePolicy.contract(game.id)))
        rejected { ResourcePolicy.parseCatalog(json,"d".repeat(64)) }
        assertEquals(0,DynamicGamePolicy.parseCatalog(json.put("games",JSONArray()),"d".repeat(64)).games.size)
    }
    @Test fun rejectsDuplicatesReservedIdsPathsAndCoercion() {
        for((key,value) in listOf("id" to "conway","id" to "../x","available" to "true","bridgeProtocol" to 0,"sourceRepository" to "https://evil.example/x.git","assetId" to 0,"minHostVersionCode" to 3,"entryPage" to "plugin.dex")) {
            val json=fixture();json.getJSONArray("games").getJSONObject(0).put(key,value);rejected { DynamicGamePolicy.parseCatalog(json,"d".repeat(64)) }
        }
        val duplicate=fixture();val array=duplicate.getJSONArray("games");array.put(JSONObject(array.getJSONObject(0).toString()).put("id","other-demo"));rejected { DynamicGamePolicy.parseCatalog(duplicate,"d".repeat(64)) }
        for(path in listOf("../x","plugin.so","catalog.signed.json")) {val json=fixture();json.getJSONArray("games").getJSONObject(0).getJSONArray("files").put(JSONObject().put("path",path).put("bytes",0).put("sha256","c".repeat(64)).put("mime",ResourcePolicy.mime(path)));rejected { DynamicGamePolicy.parseCatalog(json,"d".repeat(64)) }}
    }
    @Test fun signatureFreshnessAndExpiredInstalledProofAreDistinct() {
        val pair=KeyPairGenerator.getInstance("RSA").apply {initialize(3072)}.generateKeyPair();val bytes=fixture().toString().toByteArray()
        val signature=Signature.getInstance("SHA256withRSA").run {initSign(pair.private);update(bytes);sign()}
        val json=JSONObject().put("envelopeVersion",1).put("keyId","fixture").put("payloadBase64",Base64.getEncoder().encodeToString(bytes)).put("signatureBase64",Base64.getEncoder().encodeToString(signature))
        val envelope=json.toString().toByteArray()
        assertEquals(1L,DynamicGamePolicy.verifyEnvelope(envelope,pair.public.encoded,now,"fixture").sequence)
        rejected { DynamicGamePolicy.verifyEnvelope(envelope,pair.public.encoded,now+86400000,"fixture") }
        assertEquals(1L,DynamicGamePolicy.verifyProof(envelope,pair.public.encoded,"fixture").sequence)
        json.put("payloadBase64",Base64.getEncoder().encodeToString("{}".toByteArray()));rejected { DynamicGamePolicy.verifyProof(json.toString().toByteArray(),pair.public.encoded,"fixture") }
    }
}
