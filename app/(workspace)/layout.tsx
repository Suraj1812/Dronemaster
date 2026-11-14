import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {WorkspaceShell} from '@/components/workspace';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const u=await requireChatGPTUser('/dashboard');return <WorkspaceShell user={{name:u.displayName,email:u.email}}>{children}</WorkspaceShell>;}
