export async function claimLessonRequest(auth,{userLimit}={}){
 const configured=Number(process.env.LESSON_DAILY_REQUEST_BUDGET||500)
 const dailyBudget=Number.isInteger(configured)&&configured>0?configured:500
 if(Number.isInteger(userLimit)&&userLimit>10){
  // Week building uses a separate claim with a higher per-user burst and the same global daily budget.
  // If that function is missing, fall back to the standard limit instead of failing.
  const {data,error}=await auth.admin.rpc('claim_week_lesson_request',{request_user:auth.user.id,daily_budget:dailyBudget,user_limit:userLimit})
  if(!error)return data===true
 }
 const {data,error}=await auth.admin.rpc('claim_lesson_request',{request_user:auth.user.id,daily_budget:dailyBudget})
 if(error)throw new Error('Usage verification is temporarily unavailable. Please try again shortly.')
 return data===true
}
