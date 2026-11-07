/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * M2: bounded microphone PCM ring and optional explicit take.
 * No network, storage, speaker monitoring or unbounded sample messages.
 */
"use strict";

class SoundLabMicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.maxFrames = Math.max(1, Math.round(sampleRate * 30));
    this.ring = new Float32Array(this.maxFrames);
    this.write = 0;
    this.filled = 0;
    this.total = 0;
    this.takeStart = null;
    this.takeId = 0;
    this.frozenTake = null;
    this.lastProgress = 0;
    this.port.onmessage = event => this.handle(event.data);
  }

  copy(count) {
    const length = Math.max(0, Math.min(this.filled, this.maxFrames, Math.floor(count)));
    const result = new Float32Array(length);
    if (!length) return result;
    const start = (this.write - length + this.maxFrames) % this.maxFrames;
    const first = Math.min(length, this.maxFrames - start);
    result.set(this.ring.subarray(start, start + first));
    if (first < length) result.set(this.ring.subarray(0, length - first), first);
    return result;
  }

  finishTake(reason) {
    if (this.takeStart !== null) {
      this.frozenTake = this.copy(this.total - this.takeStart);
      this.takeStart = null;
    }
    this.port.postMessage({ type: "takeStopped", takeId: this.takeId, reason,
      frames: this.frozenTake?.length || 0,
      sampleRate });
  }

  handle(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "beginTake") {
      this.frozenTake = null;
      this.takeId = Number.isSafeInteger(message.takeId) ? message.takeId : this.takeId + 1;
      this.takeStart = this.total;
      this.port.postMessage({ type: "takeStarted", takeId: this.takeId });
    } else if (message.type === "stopTake") {
      this.finishTake("manual");
    } else if (message.type === "snapshot" && Number.isSafeInteger(message.id)) {
      const take = this.takeStart !== null || this.frozenTake !== null;
      const samples = this.takeStart !== null ? this.copy(this.total - this.takeStart) :
        this.frozenTake || this.copy(this.filled);
      this.port.postMessage({ type: "snapshot", id: message.id, mode: take ? "take" : "rolling",
        sampleRate, samples }, [samples.buffer]);
    }
  }

  process(inputs, outputs) {
    // The worklet has a zero-output path for WebKit graph scheduling. The
    // downstream sink is additionally gain=0 before it reaches destination.
    for (const output of outputs) for (const channel of output) channel.fill(0);
    const channels = inputs[0] || [];
    const frames = channels[0]?.length || outputs[0]?.[0]?.length || 128;
    for (let i = 0; i < frames; i++) {
      let value = 0;
      for (const channel of channels) value += Number.isFinite(channel[i]) ? channel[i] : 0;
      this.ring[this.write] = channels.length ? value / channels.length : 0;
      this.write = (this.write + 1) % this.maxFrames;
      this.filled = Math.min(this.maxFrames, this.filled + 1);
      this.total++;
      if (this.takeStart !== null && this.total - this.takeStart >= this.maxFrames) {
        this.finishTake("limit");
      }
    }
    if (this.total - this.lastProgress >= Math.max(1, Math.floor(sampleRate / 4))) {
      this.lastProgress = this.total;
      this.port.postMessage({ type: "progress", available: this.filled / sampleRate,
        take: this.takeStart === null ? null : (this.total - this.takeStart) / sampleRate });
    }
    return true;
  }
}

registerProcessor("soundlab-mic-capture", SoundLabMicCaptureProcessor);
