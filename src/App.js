import './App.css';
import { Layout, Button, notification, message } from 'antd';
import { useEffect, useState } from 'react';
import Header from './Containers/Header';
import Sider from './Containers/Sider';
import Content from './Containers/Content';
import Login from './Containers/Login';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import { QueryGetUser, QueryFindUser, QueryAllUsers, QueryAllGroups, QueryFindGroups } from './graphql/querys';
import { MutationAcceptInvite, MutationRemoveMessage } from './graphql/mutations';

const LOCALSTORAGE_KEY = "save-account"
const LOCALSTORAGE_KEY_LOGIN = "save-login"

function App() {

    const savedAccount = localStorage.getItem(LOCALSTORAGE_KEY)
    const savedLogin = localStorage.getItem(LOCALSTORAGE_KEY_LOGIN)
    /* When developing, you can change the following variable */
    const [account, setAccount] = useState(JSON.parse(savedAccount) || {name: '', password: ''});
    const [signIn, setSignIn] = useState(savedLogin||false)
    /* -------------------------------------------------- */

    const [allUsers, setAllUsers] = useState([])
    const [allGroups, setAllGroups] = useState([])
    
    const [myGroupIDs, setMyGroupsIDs] = useState([])
    const [groupID_Name, setGroupIDName] = useState({})
    const [groups, setGroups] = useState([])
    const [groupSortBy, setGroupSortBy] = useState("Ascending")
    const [sortGroupNames, setSortGroupNames] = useState([])
    const [selectedGroupIDs, setSelectedGroupIDs] = useState([])
    const [notifications, setNotifications] = useState([])
    
    const { loading: getUserLoading, error, data: getUserData } = useQuery(QueryGetUser, {variables:{name: account.name, password: account.password}, fetchPolicy: "no-cache", pollInterval: 1000})
    const [ findUser, { loading: findUserLoading, data: findUserData} ] = useLazyQuery(QueryFindUser, {fetchPolicy: "no-cache"})
    const [ findGroups, { loading: findGroupsLoading, data: findGroupsData }] = useLazyQuery(QueryFindGroups, {fetchPolicy: "no-cache"})
    const [ getUsers, { data: allUsersData }] = useLazyQuery(QueryAllUsers, {fetchPolicy: "no-cache"})
    const [ getGroups, { data: allGroupsData}] = useLazyQuery(QueryAllGroups, {fetchPolicy: "no-cache"})

    const [ acceptInvite, {data: acceptInviteData} ] = useMutation(MutationAcceptInvite)
    const [ removeMessage ] = useMutation(MutationRemoveMessage)
    
    const closeNotification = () => {
        console.log(
            'Notification was closed. Either the close button was clicked or duration time elapsed.',
        )
    }
    
    
    /* Fetch login-in user data and notifications */
    useEffect(()=>{
        if(getUserData) {
            const { msg } =  getUserData.getuser
            switch(msg) {
                case "success":{
                    const { groups, messages } =  getUserData.getuser.data
                    setGroups(groups)
                    setNotifications(messages)
                    if (groups.length>0)
                        setMyGroupsIDs(groups.map(i=>i.id))
                    break
                }
                default: { }
            }
        }
    }, [getUserData])
    
    /* Fetch the user names and groups names */
    useEffect(()=> {
        if (signIn){
            console.log("try refetch users groups after signin")
            getUsers()
            getGroups()
        }
    }, [signIn])

    /* Set the user names and group names displaying in the search bar */
    useEffect(() => {
        if(allUsersData) {
            console.log("refetch users")
            let _users = [...allUsersData.allUsers]
            _users = _users.sort()
            setAllUsers([..._users])
        }
        if(allGroupsData) {
            console.log("refetch groups")
            var _groups = [...Array.from(new Set(allGroupsData.allGroups))]
            _groups = _groups.sort()
            setAllGroups([..._groups])
        }
    }, [allUsersData, allGroupsData])

    /* Fetch the certain user's group data */
    useEffect(() => {
        if(findUserData) {
            const { msg } =  findUserData.finduser
            switch(msg) {
                case "success":{
                    const { groups } = findUserData.finduser.data
                    setGroups(groups)
                    break
                }
                default: { }
            }
        }
    }, [findUserData])

    /* Fetch the group data (search by group name) */
    useEffect(() => {
        if(findGroupsData) {
            if (findGroupsData.findGroups)
                setGroups(findGroupsData.findGroups)
        }
    }, [findGroupsData])

    /* Set the group data displaying in the content */
    useEffect(()=>{
        var _groups = [...groups]
        _groups.sort((a, b) => a.name.localeCompare(b.name))
        setSortGroupNames(_groups)
        var _groupIDName = {}
        groups.map(i=>{
            const {id, name} = i
            _groupIDName[id] = name
            return 0
        })
        setGroupIDName({..._groupIDName})
    }, [groups])

    /* Show the notification when get the message */
    useEffect(() => {
        const clickAcceptGroupInvite = async (_key, _notificationID) => {
            await acceptInvite({variables:{ user: account.name, password: account.password, message_id: _notificationID}})
            notification.close(_key)
            await removeMessage({variables:{ user: account.name, password: account.password, message_id: _notificationID}})
        }
        
        const openNotification = (_notification) => {
            const key = `open${Date.now()}`;
            const btn = (
                <Button type="primary" size="small" 
                    onClick={_notification.type === "group_invite"?
                        ()=>{clickAcceptGroupInvite(key, _notification.id)}:
                        ()=>{}}
                >
                    Accept
                </Button>
            )
            if (_notification.type === "group_invite")
                notification.open({
                    message: _notification.type === "group_invite" ? "New Group Invitation!": "New message",
                    description: _notification.contain,
                    btn,
                    key,
                    onClose: closeNotification,
                    duration: 0
                })
        }
        
        notifications.map(i => {
            openNotification(i)
            return 0
        })
    }, [notifications])

    /* Show the message after accepting invite group */ 
    useEffect(()=> {
        if(acceptInviteData) {
            const {msg} = acceptInviteData.acceptInvite
            switch(msg){
                case "you accept this invite successfully": {
                    message.success("You join the group!", 3)
                    break
                }
                case "group aready in your group list":{
                    message.info("You have already joined the group!", 3)
                    break
                }
                default:{ }
            }
        }
    }, [acceptInviteData])

    /* Change the sider bar when the sorting change */
    useEffect( () => {
        var _display = []
        setSortGroupNames(_display)
        var _groups = [...groups]
        switch(groupSortBy){
            case "Ascending": {
                _display = _groups.sort((a, b) => a.name.localeCompare(b.name))
                break
            }
            case "Descending": {
                _display = _groups.sort((a, b) => a.name.localeCompare(b.name)).reverse()
                break
            }
            default:{
                _display = _groups.sort((a, b) => a.name.localeCompare(b.name))
                break
            }
        }
        setSortGroupNames(_display)
    }, [groupSortBy])


    const handleClickSideMenu = e => {
        var id = e.key.split('-')[1]
        // console.log(id)
        setSelectedGroupIDs(id==="All Groups"?[]:[id])
    }
    return (
        <Layout>
            <Header
                groupSortBy = {groupSortBy}
                setGroupSortBy = {setGroupSortBy}
                account = {account}
                setAccount = {setAccount}
                signIn = {signIn}
                setSignIn = {setSignIn}
                findUser = {findUser}
                findGroups = {findGroups}
                allUsers = {allUsers}
                allGroups = {allGroups}
            />
            {signIn ?
            (<Layout>
                <Sider
                    loading = { getUserLoading || findUserLoading || findGroupsLoading }
                    error = {error}
                    sortGroupNames = {sortGroupNames}
                    handleClickSideMenu = {handleClickSideMenu}
                />
                <Content
                    account = {account}
                    allGroupIDs = {groups.map(i=> i.id)}
                    selectedGroupIDs = {selectedGroupIDs}
                    setSelectedGroupIDs = {setSelectedGroupIDs}
                    groupID_Name = {groupID_Name}
                    myGroupIDs = {myGroupIDs}
                    allUsers = {allUsers}
                />
            </Layout>) :
            (<Login
                setAccount = {setAccount}
                setSignIn = {setSignIn}
                LOCALSTORAGE_KEY = {LOCALSTORAGE_KEY}
                LOCALSTORAGE_KEY_LOGIN = {LOCALSTORAGE_KEY_LOGIN}
            />)
            }
            {/* <Footer>Footer</Footer> */}
        </Layout>
    )
}

export default App;