import { gunzipSync } from "zlib"
import { decompressSync } from "cppzst"
import { hash64 } from "xxhash"

Array.prototype.search = function(index, value) {
    let i = 0
    for (const item of this) {
        if (item[index] == value) return i
        i++
    }
}

Buffer.prototype.read = function(format, offset = 0) {
    let tmp = []
    let index = 0
    format.split("").forEach(char => {
        switch (char) {
            case "B": {
                tmp.push(this.readUInt8(offset + index))
                index += 1
                break
            }
            case "W": {
                tmp.push(this.readUInt16LE(offset + index))
                index += 2
                break
            }
            case "I": {
                tmp.push(this.readUInt32LE(offset + index))
                index += 4
                break
            }
            case "Q": {
                tmp.push(this.readBigUInt64LE(offset + index))
                index += 8
                break
            }
        }
    })
    return tmp 
}

export class Wad {
    constructor(binary) {
        this.binary = binary
        const [majorVersion, minorVersion] = this.binary.read("BB", 2)
        switch (majorVersion) {
            case 1: {
                this.entryOffset = 8
                break
            }
            case 2: {
                this.entryOffset = 100
                break
            }
            case 3: {
                this.entryOffset = 268
                break
            }
            default: {
                return Error(`Unknown Version ${majorVersion}.${minorVersion}`)
            }
        }
        this.entryCount = this.binary.readUInt32LE(this.entryOffset)
        this.entries = []
        for (let i = 0; i < this.entryCount; i++) {
            this.entries.push(new WadEntry(this, i))
        }
    }

    getEntry(path) {
        const index = this.entries.search("pathHash", hash64(Buffer.from(path), 0).readBigUInt64LE())
        if (index) {
            return this.entries[index]
        }
    }
}

class WadEntry {
    constructor(wad, index) {
        this.wad = wad
        this.index = index
        this.parse(... this.wad.binary.read("QIIIB", this.wad.entryOffset + 4 + index * 32))
    }

    parse(pathHash, offset, compressedSize, size, type) {
        this.pathHash = pathHash
        this.offset = offset
        this.compressedSize = compressedSize
        this.size = size
        this.type = type
    }

    getData() {
        switch (this.type) {
            case 0: {
                return this.getRawData()
            }
            case 1: {
                return gunzipSync(this.getRawData())
            }
            case 2: {
                return null
            }
            case 3: {
                return decompressSync(this.getRawData())
            }
        }
    }

    getRawData() {
        return this.wad.binary.slice(this.offset, this.offset + this.compressedSize)
    }
}