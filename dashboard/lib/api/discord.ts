import { dashboardFetch } from "./client"
import type { Guild, TextChannel, VoiceChannel } from "@/lib/types"

export function fetchGuilds() {
  return dashboardFetch<Guild[]>("/api/discord/guilds")
}

export function fetchVoiceChannels(guildId: string) {
  return dashboardFetch<VoiceChannel[]>(`/api/discord/guilds/${guildId}/voice-channels`)
}

export function fetchTextChannels(guildId: string) {
  return dashboardFetch<TextChannel[]>(`/api/discord/guilds/${guildId}/text-channels`)
}
