import React from 'react'
import { Plus } from "lucide-react";
const Team = () => {
  return (
    <div>
        <div>
            <h1>Admin Dashboard</h1>
            <p>The people behind the Chair</p>
            <div className='flex flex-row '>
            <p>Manage your team from one workspace</p>

            <button className='flex gap-1 bg-amber-900 border pr-2'>
                <Plus size={15} />
                <p>Add Member</p>
            </button>
        

            </div>
        </div>

    


      
    </div>
  )
}

export default Team
