import { JoinRoomButton } from "@/components/join-room-button"
import { LeaveRoomButton } from "@/components/leave-room-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getCurrentUser } from "@/services/supabase/lib/getCurrentUser"
import { createAdminClient } from "@/services/supabase/server"
import { MessagesSquareIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function Home() {
  const user = await getCurrentUser()
  if (user == null) {
    redirect("/auth/login")
  }

  const [publicRooms, joinedRooms] = await Promise.all([
    getPublicRooms(),
    getJoinedRooms(user.id), // Replace with actual user ID
  ])

  if (publicRooms.length === 0 && joinedRooms.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquareIcon />
            </EmptyMedia>
            <EmptyTitle>No Chat Rooms</EmptyTitle>
            <EmptyDescription>
              Create a new chat room to get started
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="rooms/new">Create Room</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <RoomList title="Your Rooms" rooms={joinedRooms} isJoined />
      <RoomList
        title="Public Rooms"
        rooms={publicRooms.filter(
          room => !joinedRooms.some(r => r.id === room.id)
        )}
      />
    </div>
  )
}

function RoomList({
  title,
  rooms,
  isJoined = false,
}: {
  title: string
  rooms: { id: string; name: string; memberCount: number }[]
  isJoined?: boolean
}) {
  if (rooms.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl">{title}</h2>
        <Button asChild>
          <Link href="/rooms/new">Create Room</Link>
        </Button>
      </div>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
        {rooms.map(room => (
          <RoomCard {...room} key={room.id} isJoined={isJoined} />
        ))}
      </div>
    </div>
  )
}

function RoomCard({
  id,
  name,
  memberCount,
  isJoined,
}: {
  id: string
  name: string
  memberCount: number
  isJoined: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        {isJoined ? (
          <>
            <Button asChild className="grow" size="sm">
              <Link href={`/rooms/${id}`}>Enter</Link>
            </Button>
            <LeaveRoomButton roomId={id} size="sm" variant="destructive">
              Leave
            </LeaveRoomButton>
          </>
        ) : (
          <JoinRoomButton
            roomId={id}
            variant="outline"
            className="grow"
            size="sm"
          >
            Join
          </JoinRoomButton>
        )}
      </CardFooter>
    </Card>
  )
}

async function getPublicRooms() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("chat_room")
    .select("id, name, chat_room_member (count)")
    .eq("is_public", true)
    .order("name", { ascending: true })

  if (error) {
    return []
  }

  return data.map(room => ({
    id: room.id,
    name: room.name,
    memberCount: room.chat_room_member[0].count,
  }))
}

async function getJoinedRooms(userId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("chat_room")
    .select("id, name, chat_room_member (member_id)")
    .order("name", { ascending: true })

  if (error) {
    return []
  }

  return data
    .filter(room => room.chat_room_member.some(u => u.member_id === userId))
    .map(room => ({
      id: room.id,
      name: room.name,
      memberCount: room.chat_room_member.length,
    }))
}
