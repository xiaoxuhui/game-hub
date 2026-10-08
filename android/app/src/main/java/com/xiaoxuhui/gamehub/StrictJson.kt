package com.xiaoxuhui.gamehub

import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** Parse before org.json can discard duplicate keys or coerce field types. */
internal object StrictJson {
    fun parse(bytes: ByteArray, limit: Int = 524288): JSONObject {
        require(bytes.size <= limit) { "JSON exceeds byte budget" }
        val text = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
        return Parser(text).parse() as? JSONObject ?: error("Expected JSON object")
    }
    private class Parser(private val text: String) {
        private var at = 0
        fun parse(): Any { val result = value(0); whitespace(); require(at == text.length) { "Trailing JSON" }; return result }
        private fun whitespace() { while (at < text.length && text[at] in " \t\r\n") at++ }
        private fun take(c: Char) { require(at < text.length && text[at++] == c) { "Invalid JSON delimiter" } }
        private fun string(): String {
            take('"'); val result = StringBuilder()
            while (at < text.length) {
                val c = text[at++]
                if (c == '"') return result.toString()
                require(c >= ' ') { "JSON string control character" }
                if (c != '\\') { result.append(c); continue }
                require(at < text.length) { "JSON escape truncated" }
                when (val escaped = text[at++]) {
                    '"', '\\', '/' -> result.append(escaped)
                    'b' -> result.append('\b'); 'f' -> result.append('\u000c'); 'n' -> result.append('\n'); 'r' -> result.append('\r'); 't' -> result.append('\t')
                    'u' -> { require(at + 4 <= text.length) { "JSON unicode truncated" }; val hex = text.substring(at, at + 4); require(hex.matches(Regex("[0-9a-fA-F]{4}"))); result.append(hex.toInt(16).toChar()); at += 4 }
                    else -> error("Invalid JSON escape")
                }
            }
            error("Unterminated JSON string")
        }
        private fun value(depth: Int): Any {
            require(depth <= 32) { "JSON nesting exceeds budget" }; whitespace(); require(at < text.length)
            return when (text[at]) {
                '"' -> string()
                '{' -> {
                    at++; whitespace(); val objectValue = JSONObject(); val keys = HashSet<String>()
                    if (at < text.length && text[at] == '}') { at++; objectValue } else {
                        while (true) { whitespace(); val key = string(); require(keys.add(key)) { "Duplicate JSON key" }; whitespace(); take(':'); objectValue.put(key, value(depth + 1)); whitespace(); if (at < text.length && text[at] == '}') { at++; break }; take(',') }
                        objectValue
                    }
                }
                '[' -> {
                    at++; whitespace(); val array = JSONArray()
                    if (at < text.length && text[at] == ']') { at++; array } else {
                        while (true) { array.put(value(depth + 1)); whitespace(); if (at < text.length && text[at] == ']') { at++; break }; take(',') }
                        array
                    }
                }
                else -> {
                    val match = Regex("^(true|false|null|-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)").find(text.substring(at)) ?: error("Invalid JSON value")
                    at += match.value.length
                    when (match.value) { "true" -> true; "false" -> false; "null" -> JSONObject.NULL; else -> match.value.toLongOrNull() ?: match.value.toDouble().also { require(it.isFinite()) } }
                }
            }
        }
    }
}
