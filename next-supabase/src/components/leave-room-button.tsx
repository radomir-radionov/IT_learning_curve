"use client"

import { ComponentProps } from "react"
import { ActionButton } from "./ui/action-button"
import { useCurrentUser } from "@/services/supabase/hooks/useCurrentUser"
import { createClient } from "@/services/supabase/client"
import { useRouter } from "next/navigation"

export function LeaveRoomButton({
  children,
  roomId,
  ...props
}: Omit<ComponentProps<typeof ActionButton>, "action"> & { roomId: string }) {
  const { user } = useCurrentUser()
  const router = useRouter()

  async function leaveRoom() {
    if (user == null) {
      return { error: true, message: "User not logged in" }
    }

    const supabase = createClient()
    const { error } = await supabase
      .from("chat_room_member")
      .delete()
      .eq("chat_room_id", roomId)
      .eq("member_id", user.id)

    if (error) {
      return { error: true, message: "Failed to leave room" }
    }

    router.refresh()

    return { error: false }
  }

  return (
    <ActionButton {...props} action={leaveRoom}>
      {children}
    </ActionButton>
  )
}
