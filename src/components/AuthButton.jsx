import { useAuth } from '../contexts/AuthContext'

export default function AuthButton() {
  const { user, login, logout } = useAuth()

  if (user) {
    return (
      <button
        onClick={logout}
        className="fixed bottom-5 left-6 flex items-center gap-2
                   text-white/25 hover:text-white/40 transition-colors duration-500"
      >
        {user.profilePicture?.['150x150'] ? (
          <img
            src={user.profilePicture['150x150']}
            alt=""
            className="w-5 h-5 rounded-full opacity-60"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-white/10" />
        )}
        <span className="text-[10px] tracking-wider">@{user.handle}</span>
      </button>
    )
  }

  return (
    <button
      onClick={login}
      className="fixed bottom-5 left-6 flex items-center gap-2
                 text-white/25 hover:text-white/40 transition-colors duration-500"
    >
      <span className="text-[10px] tracking-wider">log in with Audius</span>
    </button>
  )
}
