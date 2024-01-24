/* ----------------------------------------------------------------
Snippet from logging API endpoints (with JWT auth)
*/
api.get('/logs/payments', async (req, res) => {
  if (!currentUser.isWsUser(req)) return res.error(403)
  const {startDate, endDate} = getPeriodDates(req.query.days)
  return await db.getPayments(startDate, endDate)
})

// endpoint /logs status route
api.get('/logs/status', async () => {
  return {status: 'running', version: process.env.DEPLOY_VERSION}
})


/* ----------------------------------------------------------------
Snippet from functional tests.
*/
it('creates student', async () => {
  const sName = `Student ${epoch}`
  const data = {
    name: sName, 
    dob: '2016-11-11', 
    roomId: user.currentAccount.rooms[0]
  }
  const res = await req('post', '/students', {data, headers})
  expect(res.status).toEqual(200) // on error, check res.body
  expect(res.body).toBeTruthy()

  student = res.body
  expect(student.name).toEqual(sName)
})

/* ----------------------------------------------------------------
Snippet from account repository.
Example async, parallel processing, spread operator.
*/
module.exports.getAccountPlan = async (accountId) => {
  let [ account, stds ] = await Promise.all([
    exports.getAccount(accountId),
    exports.getAccountStudents(accountId)
  ])
  const activeStds = stds.filter(x => x.status === defaultStudentStatus)?.length || 0
  const res = {
    ...account.plan,
    seatsUsed: activeStds
  }
  if (account.plan.seats)
    res.seatsAvail = account.plan.seats-activeStds
  return res
}

/* ----------------------------------------------------------------
Snippet from analytics service.
Example async, dynamodb, parallel, 3rd party throttling 
*/
exports.tagPaidInMailchimp = async () => {
	const db = require('../dynamo')
  const items = await db.fullScan({
    TableName: process.env.USERS_TABLE,
    FilterExpression: 'ent = :ent AND added > :added',
    ExpressionAttributeValues: {':ent': 'payment', ':added': '2021-09-01'},
    ProjectionExpression: ['uid']
  })

  const promises = items.map(async(i) => {
    const user = await docClient.query({
      TableName: process.env.USERS_TABLE,
      IndexName: 'sk-pk-index', // GSI
      KeyConditionExpression: 'sk = :uid',
      FilterExpression: 'ent = :ent',
      ExpressionAttributeValues: {':uid': `usr#${i.uid}`, ':ent': 'user'},
      ProjectionExpression: ['pk']
    }).promise()
    exports.tagContact(user.Items[0].pk, 'paid')
  })

  // MC limit 10 conseq connections
  const chunkSize = 10
  const chunked = [...Array(Math.ceil(promises.length / chunkSize))].map((_,i) => promises.slice(i*chunkSize,i*chunkSize+chunkSize))
  for (const c of chunked)
    await Promise.all(c)

  return `Processed ${items.length} items`
}

