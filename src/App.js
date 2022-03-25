/* src/App.js */
import React, { useEffect, useState } from 'react'
import Amplify, { Auth, API, graphqlOperation } from 'aws-amplify'
//import { createTodo } from './graphql/mutations'
import { listLeaveEvents } from './graphql/queries'
import { withAuthenticator } from '@aws-amplify/ui-react'
import awsExports from "./aws-exports";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link
} from 'react-router-dom';

Amplify.configure(awsExports);
Auth.currentUserInfo()
    .then(data => console.log(data))
    .catch(err => console.log(err));

var dateFormat = require("dateformat");
const initialState = { leaveType: '', startDate: new Date(new Date().toISOString().slice(0, 10)), endDate: new Date(new Date().toISOString().slice(0, 10)) }
var paidDaysInitial = []
var leaveEvents = []

const LeaveApp = () => {
    const [formState, setFormState] = useState(initialState)
    const [leaves, setLeaves] = useState([])
    const [paidDays, setPaidDays] = useState([])

    useEffect(() => {
        fetchLeaveEvents()
    }, [])

    function setInput(key, value) {
        setFormState({ ...formState, [key]: value })
    }

    async function fetchLeaveEvents() {
        try {
            const leaveEventData = await API.graphql(graphqlOperation(
                listLeaveEvents,
                {
                    filter:
                    {
                        or: [
                            { and: [{ GSI1: { eq: "Kaur Tiitus" } }, { GSI2: { eq: "leave" } }] },
                            { and: [{ GSI1: { eq: "Kaur Tiitus" } }, { GSI2: { eq: "paidDays" } }] },
                            { and: [{ GSI1: { eq: "2020" } }, { GSI2: { eq: "freeDays" } }] },
                            { and: [{ GSI1: { eq: "2021" } }, { GSI2: { eq: "freeDays" } }] },
                        ]
                    }
                }))
            const leaves = []
            for (let i of leaveEventData.data.listLeaveEvents.items) {
                i.startDate = new Date(i.startDate)
                i.endDate = new Date(i.endDate)
                if (i.GSI2 == 'leave' || i.GSI2 == 'freeDays') {
                    leaveEvents.push(i)
                    if (i.GSI2 == 'leave') {
                        leaves.push(i)
                    }
                }
                else if (i.GSI2 == 'paidDays') {
                    paidDaysInitial.push(i)
                }
            }
            setLeaves(leaves)
        } catch (err) { console.log('error fetching leaveEvents') }
        setPaidDays(calcPaidDays(paidDaysInitial, leaveEvents))
    }

    async function addLeave() {
        try {
            if (!formState.leaveType || !formState.startDate || !formState.endDate) return
            const leave = { id: formState.startDate.getTime(), leaveType: formState.leaveType, startDate: formState.startDate, endDate: new Date(formState.endDate), moveExpiration: 0, usePaid: 1, collectPaid: 0 }
            setLeaves([...leaves, leave])
            setFormState(initialState)
            leaveEvents = [...leaveEvents, leave]
            setPaidDays(calcPaidDays(paidDaysInitial, leaveEvents))
            console.log(leaveEvents)
            //     await API.graphql(graphqlOperation(createTodo, {input: todo}))
        } catch (err) {
            console.log('error creating todo:', err)
        }
    }

    function calcPaidDays(paidDaysInitial, leaveEvents) {
        let endDate = new Date('2021-12-31') //the last application end date or later chosen by the user
        let calendarDate
        let timeline = []
        //timeline start date
        let paidDays = []
        for (let i of paidDaysInitial) {
            paidDays.push({ paidDays: i.paidDays, startDate: new Date(i.startDate.getTime()), endDate: new Date(i.endDate.getTime()) })
        }
        let startDate = paidDays[0].startDate
        //construction of the timeline day by day
        for (let i = 0; i < (endDate.getTime() - startDate.getTime()) / 1000 / 3600 / 24 + 1; i++) {
            calendarDate = new Date(startDate.getTime() + i * 1000 * 3600 * 24)
            calendarDate = { startDate: calendarDate, moveExpiration: 0, usePaid: 0, collectPaid: 1, endDate: new Date((calendarDate.getFullYear() + 1) + '-12-31') }
            for (let i2 of leaveEvents) {
                if (calendarDate.startDate.getTime() >= i2.startDate.getTime() && calendarDate.startDate.getTime() <= i2.endDate.getTime()) {
                    calendarDate.moveExpiration = calendarDate.moveExpiration + i2.moveExpiration
                    calendarDate.usePaid = Math.max(calendarDate.usePaid + i2.usePaid, 0)
                    calendarDate.collectPaid = calendarDate.collectPaid + i2.collectPaid
                }
            }
            timeline.push(calendarDate)
        }
        //paid days calculation day by day
        for (let i of timeline) {
            for (let i2 of paidDays) {
                i2.startDate = i.startDate
                //some leaves postpone expiration date
                i2.endDate = new Date(i2.endDate.getTime() + i.moveExpiration * 1000 * 3600 * 24)
            }
            //collecting of paid days
            for (let i2 of paidDays) {
                if (i.endDate.getTime() == i2.endDate.getTime() ||
                    //if expiration date is not matching but paid days amount is negativ
                    (i.startDate.getTime() <= i2.endDate.getTime()
                        && i2.paidDays < 0)) {
                    i2.paidDays = i2.paidDays + i.collectPaid * 28 / 365
                    i.collectPaid = 0
                }
            }
            //expiration date is new
            if (i.collectPaid != 0) {
                paidDays.push({ paidDays: i.collectPaid * 28 / 365, date: i.date, endDate: i.endDate })
            }
            //using paid days
            for (let i2 of paidDays) {
                if (i2.endDate.getTime() >= i.startDate.getTime() && i.usePaid > 0) {
                    i2.paidDays = i2.paidDays - i.usePaid
                    if (i2.paidDays >= 0) {
                        i.usePaid = 0
                    }
                    //all paid days have been used, removing empty record
                    else if (paidDays.length > 1) { paidDays.shift() }
                }
            }
        }
        return (paidDays)
    }
    // The user wants to see ones applications and left paidDays rows.
    return (
        <div style={styles.container}>
            <h2>Leave application</h2>

            <input
                onChange={event => setInput('leaveType', event.target.value)}
                style={styles.input}
                value={formState.leaveType}
                placeholder="Leave Type" />

            <label style={styles.leaveType}>
                Leave Type:
                <select style={styles.input} onChange={event => setInput('leaveType', event.target.value)} value={formState.leaveType}>
                    <option value="Põhipuhkus">Põhipuhkus</option>
                    <option value="Palgata puhkus">Palgata puhkus</option>
                    <option value="Haigusleht">Haigusleht</option>
                    <option value="Vanemapuhkus">Vanemapuhkus</option>
                </select>
            </label>
            <table><tr>
                <td><DatePicker dateFormat="dd.MM.yyyy" selected={formState.startDate} onChange={date => setInput('startDate', date)} /></td>
                <td><DatePicker placeholderText="End date" dateFormat="dd.MM.yyyy" selected={formState.endDate} onChange={date => setInput('endDate', date)} /></td>
            </tr></table>
            <button style={styles.button} onClick={addLeave}>Submit</button>
            <table> <thead>Leaves</thead>
                <tr>
                    <th>Leave type</th>
                    <th>Star Date</th>
                    <th>End Date</th>
                </tr>
                {
                    leaves.map((leave, index) => (
                        <tr key={leave.id ? leave.id : index} style={styles.leave}>
                            <td style={styles.leaveType}>{leave.leaveType}</td>
                            <td style={styles.leaveDate}>{dateFormat(leave.startDate, "dd.mm.yyyy")}</td>
                            <td style={styles.leaveDate}>{dateFormat(leave.endDate, "dd.mm.yyyy")}</td>
                        </tr>
                    ))
                }
            </table>
            <table> <thead>Remaining leave days</thead>
                <tr>
                    <th>Days</th>
                    <th>Date Until</th>
                    <th>Expiration Date</th>
                </tr>
                {paidDays.map((paidDaysRow, index) => (
                    <tr key={paidDaysRow.id ? paidDaysRow.id : index} style={styles.leave}>
                        <td style={styles.leaveType}>{Math.round(paidDaysRow.paidDays)}</td>
                        <td style={styles.leaveDate}>{dateFormat(paidDaysRow.startDate, "dd.mm.yyyy")}</td>
                        <td style={styles.leaveDate}>{dateFormat(paidDaysRow.endDate, "dd.mm.yyyy")}</td>
                    </tr>
                ))
                }
            </table>
        </div>
    )
}

const App = () => {
    return (
        <Router>
            <div>
                <nav>
                    <ul>
                        <li>
                            <Link to="/">LeaveApp</Link>
                        </li>
                        <li>
                            <Link to="/about">About</Link>
                        </li>
                        <li>
                            <Link to="/users">Users</Link>
                        </li>
                    </ul>
                </nav>

                {/* A <Switch> looks through its children <Route>s and
            renders the first one that matches the current URL. */}
                <Switch>
                    <Route path="/about">
                        <About />
                    </Route>
                    <Route path="/users">
                        <Users />
                    </Route>
                    <Route path="/">
                        <LeaveApp />
                    </Route>
                </Switch>
            </div>
        </Router>
    )
}

function About() {
    return <h2>About</h2>;
}

function Users() {
    return <h2>Users</h2>;
}

const styles = {
    container: { width: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 20 },
    leave: { marginBottom: 15 },
    input: { border: 'none', backgroundColor: '#ddd', marginBottom: 10, padding: 8, fontSize: 18 },
    leaveType: { fontSize: 20, fontWeight: 'bold' },
    leaveDate: { marginBottom: 0 }, leaveAeg: { marginBottom: 0 },
    button: { backgroundColor: 'black', color: 'white', outline: 'none', fontSize: 18, padding: '12px 0px' }
}

export default withAuthenticator(App)