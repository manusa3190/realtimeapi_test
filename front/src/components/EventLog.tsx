export function EventLog({events}: {events: any[]}){

  return (<div className=' w-[30rem] border-2 border-gray-300 rounded-md p-2 max-h-[500px] overflow-y-auto'>
        <h3 className='text-lg font-bold py-2'>イベントログ</h3>
        <ul >
        {/* デルタイベントは表示しない */}
        {events.filter(e=>!e.type.endsWith("delta")).map((event, index) => (
            <li key={index} className='collapse collapse-arrow border border-gray-600'>
                <input type="radio" name="log-accordion"/>

                <div className='collapse-title flex justify-between'>
                    <div className='text-sm font-bold'>{event.type}</div>
                    <div className='text-xs text-gray-500'>{event.timestamp.toLocaleTimeString()}</div>
                </div>

                <div className='collapse-content'>
                    <pre className='text-xs bg-black'>{JSON.stringify(event, null, 2)}</pre>
                </div>                
            </li>
        ))}
        </ul>
    </div>)
}
