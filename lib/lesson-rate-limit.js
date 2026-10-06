export async function claimLessonRequest(auth){
 const configured=Number(process.env.LESSON_DAILY_REQUEST_BUDGET||500)
 const dailyBudget=Number.isInteger(configured)&&configured>0?configured:500
 const {data,error}=await auth.admin.rpc('claim_lesson_request',{request_user:auth.user.id,daily_budget:dailyBudget})
 if(error)throw new Error('Usage verification is temporarily unavailable. Please try again shortly.')
 return data===true
}
