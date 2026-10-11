
import { createHash } from "node:crypto";

const EXPECTED_ITEMS = 100_000;
const FALSE_POSITIVE_RATE = 0.01;

class BloomFilter {
    constructor(
        expectedItems = EXPECTED_ITEMS,
        falsePositiveRate = FALSE_POSITIVE_RATE
    ) {
        this.expectedItems = expectedItems;

        this.bitSize = Math.ceil(
            (-expectedItems * Math.log(falsePositiveRate)) /
            (Math.log(2) ** 2)
        );

        this.hashCount = Math.max(
            1,
            Math.round(
                (this.bitSize / expectedItems) * Math.log(2)
            )
        );

        this.bits = Buffer.alloc(Math.ceil(this.bitSize / 8));
        this.itemCount = 0;
    }

    normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    getPositions(value) {
        const normalized = this.normalize(value);

        const digest = createHash("sha256")
            .update(normalized)
            .digest();

        const h1 = digest.readBigUInt64BE(0);
        const h2 = digest.readBigUInt64BE(8) | 1n;

        const positions = [];

        for (let i = 0; i < this.hashCount; i++) {
            const position = Number(
                (h1 + BigInt(i) * h2) % BigInt(this.bitSize)
            );

            positions.push(position);
        }

        return positions;
    }

    add(value) {
        const normalized = this.normalize(value);

        if (!normalized) {
            throw new Error("Bloom Filter item cannot be empty");
        }

        for (const position of this.getPositions(normalized)) {
            const byteIndex = Math.floor(position / 8);
            const bitIndex = position % 8;

            this.bits[byteIndex] |= 1 << bitIndex;
        }

        this.itemCount++;
    }

    mightContain(value) {
        const normalized = this.normalize(value);

        if (!normalized) {
            return false;
        }

        for (const position of this.getPositions(normalized)) {
            const byteIndex = Math.floor(position / 8);
            const bitIndex = position % 8;

            if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
                return false;
            }
        }

        return true;
    }

    clear() {
        this.bits.fill(0);
        this.itemCount = 0;
    }

    getStats() {
        let occupiedBits = 0;
        for (const byte of this.bits) {
            let value = byte;
            while (value) {
                occupiedBits += value & 1;
                value >>>= 1;
            }
        }
        const bitOccupancy = occupiedBits / this.bitSize;
        const estimatedFalsePositiveRate = (1 - Math.exp(-this.hashCount * this.itemCount / this.bitSize)) ** this.hashCount;
        return {
            itemCount: this.itemCount,
            bitSize: this.bitSize,
            hashCount: this.hashCount,
            memoryBytes: this.bits.length,
            occupiedBits,
            bitOccupancy,
            estimatedFalsePositiveRate,
            targetFalsePositiveRate: FALSE_POSITIVE_RATE,
        };
    }
}

export const bloomFilter = new BloomFilter();

let bloomReady = false;
let bloomInitError = null;

// Load all existing certificate hashes from Supabase.
// Pagination is important because Supabase may limit each response.
export async function initializeBloomFilter(supabase) {
    bloomReady = false;
    bloomInitError = null;
    bloomFilter.clear();

    const batchSize = 1000;
    let offset = 0;

    try {
        while (true) {
            const { data, error } = await supabase
                .from("credentials")
                .select("document_hash")
                .not("document_hash", "is", null)
                .range(offset, offset + batchSize - 1);

            if (error) {
                throw error;
            }

            for (const row of data || []) {
                if (row.document_hash) {
                    bloomFilter.add(row.document_hash);
                }
            }

            if (!data || data.length < batchSize) {
                break;
            }

            offset += batchSize;
        }

        bloomReady = true;
        bloomInitError = null;

        console.log(
            "Bloom Filter initialized:",
            bloomFilter.getStats()
        );
    } catch (error) {
        bloomFilter.clear();
        bloomReady = false;
        bloomInitError = error.message;

        console.error("Bloom Filter initialization failed:", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
});
    }
}

export function isBloomReady() {
    return bloomReady;
}

export function getBloomStatus() {
    return { ready: bloomReady, error: bloomInitError, stats: bloomFilter.getStats() };
}
