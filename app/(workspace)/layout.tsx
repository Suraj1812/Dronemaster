import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {WorkspaceShell} from '@/components/workspace';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const u=process.env.DRONEMASTER_BACKEND_ORIGIN?{displayName:'Workspace',email:''}:await requireChatGPTUser('/dashboard');return <WorkspaceShell user={{name:u.displayName,email:u.email}}>{children}</WorkspaceShell>;}
